import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FixPatch } from "../ai/types.ts";
import type { CmsConnector } from "../cms/types.ts";
import { createCredentialVault } from "../cms/vault.ts";
import {
  COLLECTIONS,
  createDurablePlatform,
  createJsonFileAdapter,
  createMemoryAdapter,
  createPlatformGateway,
  createWriteQueue,
  type PersistenceAdapter,
} from "../platform/index.ts";
import type { PlatformRequest, Principal } from "../platform/index.ts";

const NOW = "2026-05-01T09:00:00.000Z";
const TARGET_URL = "https://example.com/blog/widgets";

const ADMIN = { id: "admin@example.com", role: "admin", organizationId: "org_1" } as const satisfies Principal;

const lowRiskPatch: FixPatch = {
  patchId: "ptch_durable_1",
  auditId: "aud_durable_1",
  targetUrl: TARGET_URL,
  mode: "universal",
  createdAt: NOW,
  mutations: [
    {
      field: "meta_description",
      action: "replace",
      before: null,
      after: "A durable, persisted meta description.",
      risk: "low",
      autoApply: false,
    },
  ],
};

function fakeConnector(): CmsConnector {
  return {
    platform: "wordpress",
    target: { url: TARGET_URL, resourceId: "42", resourceType: "posts" },
    async readSnapshot() {
      return { title: "Old title", meta_description: "Old description" };
    },
    async applyMutations(mutations) {
      return { ok: true, applied: mutations.length, errors: [] };
    },
    async verify() {
      return { ok: true, status: 200 };
    },
    async restore() {
      /* no-op for persistence tests */
    },
  };
}

function request(
  method: PlatformRequest["method"],
  path: string,
  body?: unknown,
  principal: Principal = ADMIN
): PlatformRequest {
  return { method, path, body, principal };
}

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seo-studio-platform-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function deployOnce(adapter: PersistenceAdapter): Promise<void> {
  const vault = createCredentialVault(Buffer.alloc(32, 3));
  const platform = await createDurablePlatform({ adapter, vault, now: () => NOW });
  platform.gateway.connectors.register(TARGET_URL, fakeConnector());

  const deployed = await platform.gateway.handle(
    request("POST", "/v1/deployments", { patch: lowRiskPatch, approveAll: true })
  );
  expect(deployed.status, JSON.stringify(deployed.body)).toBe(200);

  const credential = await platform.gateway.handle(
    request("POST", "/v1/credentials", {
      platform: "shopify",
      label: "Store",
      meta: { shop: "example.myshopify.com" },
      secret: { accessToken: "shpat_super_secret" },
    })
  );
  expect(credential.status, JSON.stringify(credential.body)).toBe(201);

  await platform.close();
}

/* ---------------------------------------------------------- persistence --- */

describe("Phase 5.1 — persistence adapters", () => {
  it("round-trips through the in-memory adapter", async () => {
    const adapter = createMemoryAdapter();
    await adapter.append(COLLECTIONS.auditLog, { id: "a1", sequence: 1 });
    await adapter.put(COLLECTIONS.credentials, "c1", { id: "c1", label: "One" });
    await adapter.put(COLLECTIONS.credentials, "c2", { id: "c2", label: "Two" });
    await adapter.put(COLLECTIONS.credentials, "c1", { id: "c1", label: "One (updated)" });

    expect(await adapter.readAll(COLLECTIONS.auditLog)).toHaveLength(1);
    const credentials = await adapter.readAll<{ id: string; label: string }>(COLLECTIONS.credentials);
    expect(credentials).toHaveLength(2);
    expect(credentials.find((entry) => entry.id === "c1")?.label).toBe("One (updated)");

    await adapter.remove(COLLECTIONS.credentials, "c2");
    expect(await adapter.readAll(COLLECTIONS.credentials)).toHaveLength(1);
  });

  it("persists to NDJSON and reloads across adapter instances", async () => {
    const dir = await tempDir();
    const first = createJsonFileAdapter({ dir });
    await first.append(COLLECTIONS.auditLog, { id: "a1", sequence: 1 });
    await first.put(COLLECTIONS.deployments, "d1", { id: "d1", status: "deployed" });
    await first.close?.();

    const second = createJsonFileAdapter({ dir });
    expect(await second.readAll(COLLECTIONS.auditLog)).toEqual([{ id: "a1", sequence: 1 }]);
    const deployments = await second.readAll<{ id: string }>(COLLECTIONS.deployments);
    expect(deployments).toHaveLength(1);

    await second.put(COLLECTIONS.deployments, "d1", { id: "d1", status: "rolled_back" });
    const third = createJsonFileAdapter({ dir });
    const reloaded = await third.readAll<{ status: string }>(COLLECTIONS.deployments);
    expect(reloaded[0]?.status).toBe("rolled_back");
  });

  it("serializes concurrent appends without corrupting lines", async () => {
    const dir = await tempDir();
    const adapter = createJsonFileAdapter({ dir });
    await Promise.all(
      Array.from({ length: 25 }, (_, index) => adapter.append(COLLECTIONS.auditLog, { id: `a${index}`, sequence: index }))
    );
    const records = await adapter.readAll<{ sequence: number }>(COLLECTIONS.auditLog);
    expect(records).toHaveLength(25);
    expect(records.map((record) => record.sequence).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, index) => index)
    );
  });

  it("drains write-queue operations in order and surfaces the first error", async () => {
    const queue = createWriteQueue();
    const order: number[] = [];
    queue.enqueue(async () => void order.push(1));
    queue.enqueue(async () => void order.push(2));
    queue.enqueue(async () => {
      throw new Error("boom");
    });
    queue.enqueue(async () => void order.push(4));

    await expect(queue.flush()).rejects.toThrow("boom");
    expect(order).toEqual([1, 2, 4]);
  });
});

/* ------------------------------------------------------ durable runtime --- */

describe("Phase 5.1 — durable platform", () => {
  it("hydrates audit log, history, snapshots and credentials after a restart", async () => {
    const dir = await tempDir();
    await deployOnce(createJsonFileAdapter({ dir }));

    const vault = createCredentialVault(Buffer.alloc(32, 3));
    const reopened = await createDurablePlatform({
      adapter: createJsonFileAdapter({ dir }),
      vault,
      now: () => NOW,
    });

    const audit = await reopened.gateway.handle(request("GET", "/v1/audit-log"));
    expect(audit.status).toBe(200);
    const auditBody = audit.body as {
      entries: Array<{ action: string }>;
      verification: { valid: boolean; entries: number };
    };
    expect(auditBody.verification.valid).toBe(true);
    expect(auditBody.entries.some((entry) => entry.action === "patch.deploy")).toBe(true);
    expect(auditBody.entries.some((entry) => entry.action === "credential.create")).toBe(true);

    const history = await reopened.gateway.handle(request("GET", "/v1/history"));
    expect((history.body as { entries: unknown[] }).entries).toHaveLength(1);

    const credentials = await reopened.gateway.handle(request("GET", "/v1/credentials"));
    const credentialBody = credentials.body as { credentials: Array<{ label: string }> };
    expect(credentialBody.credentials).toHaveLength(1);
    expect(JSON.stringify(credentials.body)).not.toContain("shpat_super_secret");

    expect(reopened.gateway.rollbackStore.size()).toBe(1);
    await reopened.close();
  });

  it("holds the audit chain across a restart", async () => {
    const dir = await tempDir();
    const vault = createCredentialVault(Buffer.alloc(32, 3));

    const first = await createDurablePlatform({ adapter: createJsonFileAdapter({ dir }), vault, now: () => NOW });
    first.gateway.auditLog.append({ principal: ADMIN, action: "credential.create", at: NOW });
    first.gateway.auditLog.append({ principal: ADMIN, action: "patch.approve", at: NOW });
    await first.flush();
    const headBefore = first.gateway.auditLog.head();
    await first.close();

    const second = await createDurablePlatform({ adapter: createJsonFileAdapter({ dir }), vault, now: () => NOW });
    expect(second.gateway.auditLog.size()).toBe(2);
    second.gateway.auditLog.append({ principal: ADMIN, action: "patch.deploy", at: NOW });
    await second.flush();

    const entries = second.gateway.auditLog.all();
    expect(entries).toHaveLength(3);
    expect(entries[2]!.previousHash).toBe(headBefore?.hash);
    expect(second.gateway.auditLog.verify().valid).toBe(true);
    await second.close();
  });
});

/* -------------------------------------------------------- audit & scan --- */

describe("Phase 5.1 — audit + connector routes", () => {
  function fakeFetch(html: string) {
    return async () =>
      ({
        ok: true,
        status: 200,
        text: async () => html,
        json: async () => ({}),
      }) as unknown as Response;
  }

  it("audits a live page and returns a report", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 3));
    const html =
      "<!doctype html><html lang=\"en\"><head><title>Widgets</title></head>" +
      "<body><h1>Widgets</h1><p>" +
      "A short paragraph about widgets and how they are made and used every day." +
      "</p><img src=\"/a.png\"></body></html>";

    const gateway = createPlatformGateway({ vault, now: () => NOW, fetchImpl: fakeFetch(html) });
    const response = await gateway.handle(request("POST", "/v1/audits", { url: TARGET_URL }));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const report = response.body as { auditId: string; pageUrl: string; summary: { totalIssues: number }; mode: string };
    expect(report.pageUrl).toBe(TARGET_URL);
    expect(report.mode).toBe("universal");
    expect(report.summary.totalIssues).toBeGreaterThan(0);
    expect(gateway.auditLog.all().some((entry) => entry.action === "audit.run")).toBe(true);
  });

  it("registers a target and rejects invalid cron schedules", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 3));
    const gateway = createPlatformGateway({ vault, now: () => NOW });

    const registered = await gateway.handle(request("POST", "/v1/connectors", { targetUrl: TARGET_URL }));
    expect(registered.status, JSON.stringify(registered.body)).toBe(201);
    expect((registered.body as { platform: string }).platform).toBe("custom");

    const listed = await gateway.handle(request("GET", "/v1/connectors"));
    expect((listed.body as { targets: string[] }).targets).toContain(TARGET_URL);

    const invalid = await gateway.handle(
      request("POST", "/v1/schedules", { targetUrl: TARGET_URL, cron: "definitely-not-cron" })
    );
    expect(invalid.status).toBe(400);
  });

  it("only lets admins register connectors", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 3));
    const gateway = createPlatformGateway({ vault, now: () => NOW });
    const specialist = { id: "seo@example.com", role: "specialist" } as const satisfies Principal;
    const response = await gateway.handle(
      request("POST", "/v1/connectors", { targetUrl: TARGET_URL }, specialist)
    );
    expect(response.status).toBe(403);
    expect(gateway.connectors.targets()).toHaveLength(0);
  });
});