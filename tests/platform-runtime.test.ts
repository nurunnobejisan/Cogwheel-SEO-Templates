import { describe, it, expect } from "vitest";
import type { FixPatch, PatchMutation } from "../ai/types.ts";
import type { AuditIssue, AuditReport } from "../rules/types.ts";
import type { CmsConnector, ConnectorMutation } from "../cms/types.ts";
import { createCredentialVault } from "../cms/vault.ts";
import {
  backoffDelay,
  canonicalJson,
  can,
  canApproveRisk,
  createAuditLog,
  createCredentialStore,
  createDeploymentHistory,
  createHealingRunner,
  createHeaderAuthenticator,
  createPatchStore,
  createPlatformGateway,
  createRateLimiter,
  createScanScheduler,
  createScanWorker,
  createSerialQueue,
  createTokenBucket,
  hashAuditEntry,
  NoConnectorError,
  permissionsFor,
  PlatformError,
  requireRiskApproval,
  undoDeployment,
  withRetry,
  authorize,
  type PlatformGateway,
  type PlatformRequest,
  type PlatformResponse,
  type Principal,
} from "../platform/index.ts";

const NOW = "2026-04-01T10:00:00.000Z";
const TARGET_URL = "https://example.com/blog/widgets";

const ADMIN = { id: "admin@example.com", role: "admin" } as const satisfies Principal;
const SPECIALIST = { id: "seo@example.com", role: "specialist" } as const satisfies Principal;
const VIEWER = { id: "viewer@example.com", role: "viewer" } as const satisfies Principal;

/* --------------------------------------------------------------- fixtures -- */

function makeIssue(overrides: Partial<AuditIssue> & Pick<AuditIssue, "issueId">): AuditIssue {
  return {
    category: "metadata",
    severity: "medium",
    fixable: true,
    cmsTargetField: null,
    context: { currentValue: "", selector: "head", recommendedAction: "fix it" },
    ...overrides,
  };
}

function makeReport(issues: AuditIssue[]): AuditReport {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
  }
  return {
    auditId: "aud_platform_1",
    domain: "example.com",
    pageUrl: TARGET_URL,
    timestamp: NOW,
    mode: "universal",
    modeDetection: { mode: "universal", confidence: 0.9, signals: [], overridden: false },
    issues,
    summary: { totalIssues: issues.length, bySeverity, byCategory: {}, score: 70 },
  };
}

const META_ISSUE = makeIssue({
  issueId: "iss_meta_desc_missing",
  cmsTargetField: "meta_description",
});

function mutation(overrides: Partial<PatchMutation> = {}): PatchMutation {
  return {
    field: "meta_description",
    action: "replace",
    before: null,
    after: "A freshly written meta description.",
    risk: "low",
    autoApply: false,
    ...overrides,
  };
}

function makePatch(mutations: PatchMutation[]): FixPatch {
  return {
    patchId: "ptch_platform_1",
    auditId: "aud_platform_1",
    targetUrl: TARGET_URL,
    mode: "universal",
    createdAt: NOW,
    mutations,
  };
}

const LOW_PATCH = makePatch([mutation()]);
const HIGH_PATCH = makePatch([
  mutation({ field: "canonical_url", action: "replace", after: TARGET_URL, risk: "high" }),
]);

interface FakeState {
  applied: ConnectorMutation[];
  appliedCalls: number;
  restored: boolean;
  restoredWith: Record<string, unknown> | null;
}

function createFakeConnector(): { connector: CmsConnector; state: FakeState } {
  const state: FakeState = { applied: [], appliedCalls: 0, restored: false, restoredWith: null };
  const connector: CmsConnector = {
    platform: "wordpress",
    target: { url: TARGET_URL, resourceId: "42", resourceType: "posts" },
    async readSnapshot() {
      return { title: "Old title", meta_description: "Old description" };
    },
    async applyMutations(mutations) {
      state.appliedCalls += 1;
      state.applied = mutations;
      return { ok: true, applied: mutations.length, errors: [] };
    },
    async verify() {
      return { ok: true, status: 200 };
    },
    async restore(snapshot) {
      state.restored = true;
      state.restoredWith = snapshot;
    },
  };
  return { connector, state };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Serve the live page reflecting whatever the connector actually wrote. */
function reflectingFetch(state: FakeState) {
  return async () => {
    const meta = state.applied.find((m) => m.field === "meta_description");
    const html =
      "<!doctype html><html><head><title>Live</title>" +
      (meta && typeof meta.after === "string"
        ? `<meta name="description" content="${escapeAttr(meta.after)}">`
        : "") +
      "</head><body><h1>Live</h1></body></html>";
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => html,
    } as unknown as Response;
  };
}

function request(
  method: PlatformRequest["method"],
  path: string,
  principal: Principal = ADMIN,
  body?: unknown
): PlatformRequest {
  return { method, path, principal, body };
}

function expectStatus(response: PlatformResponse, status: number): void {
  expect(response.status, JSON.stringify(response.body)).toBe(status);
}

/* ------------------------------------------------------------------ RBAC --- */

describe("Phase 5 — RBAC", () => {
  it("grants permissions from the role matrix", () => {
    expect(permissionsFor("viewer")).toEqual(
      expect.arrayContaining(["audit:read", "patch:read", "audit-log:read"])
    );
    expect(permissionsFor("viewer")).not.toContain("patch:deploy");
    expect(can(SPECIALIST, "patch:approve")).toBe(true);
    expect(can(SPECIALIST, "credential:write")).toBe(false);
    expect(can(ADMIN, "credential:write")).toBe(true);
    expect(can(VIEWER, "history:undo")).toBe(false);
  });

  it("rejects unauthenticated and unauthorized principals", () => {
    expect(() => authorize(undefined, "audit:read")).toThrow(PlatformError);
    try {
      authorize(undefined, "audit:read");
    } catch (error) {
      expect((error as PlatformError).status).toBe(401);
    }
    try {
      authorize(VIEWER, "patch:deploy");
    } catch (error) {
      expect((error as PlatformError).status).toBe(403);
    }
  });

  it("caps approvable risk by role", () => {
    expect(canApproveRisk(ADMIN, "high")).toBe(true);
    expect(canApproveRisk(SPECIALIST, "medium")).toBe(true);
    expect(canApproveRisk(SPECIALIST, "high")).toBe(false);
    expect(canApproveRisk(VIEWER, "low")).toBe(false);

    expect(() => requireRiskApproval(ADMIN, "high")).not.toThrow();
    expect(() => requireRiskApproval(SPECIALIST, "high")).toThrow(/admin is required/);
  });

  it("reads the development header authenticator", () => {
    const authenticate = createHeaderAuthenticator();
    const principal = authenticate({
      headers: { "x-actor-id": "u1", "x-actor-role": "admin", "x-organization-id": "org_1" },
    } as unknown as Parameters<typeof authenticate>[0]);
    expect(principal).toEqual({ id: "u1", role: "admin", organizationId: "org_1" });
    expect(authenticate({ headers: {} } as unknown as Parameters<typeof authenticate>[0])).toBeUndefined();
  });
});

/* ------------------------------------------------------------- audit log --- */

describe("Phase 5 — Immutable audit log", () => {
  it("appends a hash-chained log that verifies", () => {
    const log = createAuditLog({ now: () => NOW });
    log.append({ principal: ADMIN, action: "credential.create", metadata: { credentialId: "c1" } });
    log.append({ principal: SPECIALIST, action: "patch.approve", patchId: "p1", targetUrl: TARGET_URL });
    log.append({ principal: SPECIALIST, action: "patch.deploy", patchId: "p1", targetUrl: TARGET_URL });

    expect(log.size()).toBe(3);
    expect(log.head()?.sequence).toBe(3);
    expect(log.head()?.actor).toBe(SPECIALIST.id);
    expect(log.forPatch("p1")).toHaveLength(2);

    const entries = log.all();
    expect(entries[0]!.previousHash).toBe("");
    expect(entries[1]!.previousHash).toBe(entries[0]!.hash);
    expect(entries[2]!.previousHash).toBe(entries[1]!.hash);
    expect(log.verify()).toMatchObject({ valid: true, entries: 3, brokenAt: null });
  });

  it("produces deterministic hashes bound to contents and the prior hash", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    const base = {
      sequence: 1,
      id: "alog_000001",
      at: NOW,
      actor: "u1",
      role: "admin" as const,
      action: "patch.deploy",
      previousHash: "",
    };
    const h1 = hashAuditEntry(base);
    expect(h1).toBe(hashAuditEntry(base));
    expect(hashAuditEntry({ ...base, action: "patch.reject" })).not.toBe(h1);
    expect(hashAuditEntry({ ...base, previousHash: "abc" })).not.toBe(h1);
  });
});

/* ----------------------------------------------------------- rate limits --- */

describe("Phase 5 — Rate limiting & backoff", () => {
  it("enforces a token bucket and refills over time", () => {
    let clock = 0;
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 1 }, () => clock);
    expect(bucket.tryAcquire().allowed).toBe(true);
    expect(bucket.tryAcquire().allowed).toBe(true);
    const denied = bucket.tryAcquire();
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(1000);

    clock = 1000;
    expect(bucket.tryAcquire().allowed).toBe(true);
  });

  it("keeps independent buckets per key", () => {
    const limiter = createRateLimiter({ defaultConfig: { capacity: 1, refillPerSecond: 0.01 }, now: () => 0 });
    expect(limiter.tryAcquire("a").allowed).toBe(true);
    expect(limiter.tryAcquire("a").allowed).toBe(false);
    expect(limiter.tryAcquire("b").allowed).toBe(true);
    expect(limiter.keys()).toEqual(["a", "b"]);
  });

  it("computes capped exponential backoff", () => {
    expect(backoffDelay(1, 100, 10_000, 0)).toBe(100);
    expect(backoffDelay(2, 100, 10_000, 0)).toBe(200);
    expect(backoffDelay(3, 100, 10_000, 0)).toBe(400);
    expect(backoffDelay(10, 100, 1_000, 0)).toBe(1_000);
    expect(backoffDelay(2, 100, 10_000, 0.5, () => 1)).toBe(300);
  });

  it("retries with backoff until success or a non-retryable error", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("transient");
        }
        return "ok";
      },
      { maxAttempts: 5, baseDelayMs: 10, sleep: async (ms) => void delays.push(ms), random: () => 0 }
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("stops immediately on a non-retryable error", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new NoConnectorError(TARGET_URL);
        },
        { maxAttempts: 4, sleep: async () => undefined, isRetryable: (e) => !(e instanceof NoConnectorError) }
      )
    ).rejects.toBeInstanceOf(NoConnectorError);
    expect(attempts).toBe(1);
  });

  it("serializes tasks per key", async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const first = queue.run("k", async () => {
      order.push("a-start");
      await Promise.resolve();
      order.push("a-end");
      return 1;
    });
    const second = queue.run("k", async () => {
      order.push("b-start");
      order.push("b-end");
      return 2;
    });
    await Promise.all([first, second]);
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });
});

/* ------------------------------------------------------- history & undo --- */

describe("Phase 5 — Deployment history & one-click undo", () => {
  it("restores a snapshot and marks the entry undone", async () => {
    const { connector, state } = createFakeConnector();
    const history = createDeploymentHistory(() => NOW);
    const rollbackStore = { get: () => ({ snapshot: { title: "Old title" } }) } as never;

    const entry = history.record({
      runId: "run_1",
      patchId: "p1",
      targetUrl: TARGET_URL,
      platform: "wordpress",
      status: "deployed",
      actor: ADMIN.id,
      snapshotId: "snap_1",
      diff: [],
      applied: 1,
      rolledBack: false,
      at: NOW,
    });

    const result = await undoDeployment(entry.id, {
      history,
      rollbackStore,
      resolveConnector: () => connector,
      principal: SPECIALIST,
      now: () => NOW,
    });
    expect(state.restored).toBe(true);
    expect(state.restoredWith).toEqual({ title: "Old title" });
    expect(result.entry.undone).toBe(true);
    expect(result.restoredFields).toEqual(["title"]);
    expect(history.undoable()).toHaveLength(0);

    await expect(
      undoDeployment(entry.id, {
        history,
        rollbackStore,
        resolveConnector: () => connector,
        principal: SPECIALIST,
      })
    ).rejects.toThrow(/already undone/);
  });

  it("refuses to undo when the snapshot is missing", async () => {
    const history = createDeploymentHistory(() => NOW);
    const entry = history.record({
      runId: "run_2",
      patchId: "p2",
      targetUrl: TARGET_URL,
      platform: "wordpress",
      status: "deployed",
      actor: ADMIN.id,
      snapshotId: null,
      diff: [],
      applied: 1,
      rolledBack: false,
      at: NOW,
    });
    await expect(
      undoDeployment(entry.id, {
        history,
        rollbackStore: { get: () => null } as never,
        resolveConnector: () => createFakeConnector().connector,
        principal: SPECIALIST,
      })
    ).rejects.toThrow(/no snapshot/);
  });
});

/* ---------------------------------------------------------------- worker --- */

describe("Phase 5 — Scan worker", () => {
  const fakeResult = {
    runId: "run_w",
    targetUrl: TARGET_URL,
    patchId: "p_w",
    status: "queued" as const,
    approval: {} as never,
    deployment: null,
    verification: null,
    snapshotId: null,
    events: [],
    startedAt: NOW,
    finishedAt: NOW,
  };

  it("drains due cron jobs and runs the runner", async () => {
    const scheduler = createScanScheduler();
    scheduler.register({ targetUrl: TARGET_URL, cron: "*/5 * * * *" });
    const jobs: string[] = [];
    const worker = createScanWorker({
      scheduler,
      runner: async (job) => {
        jobs.push(job.targetUrl);
        return fakeResult;
      },
      now: () => new Date("2026-04-01T10:05:00"),
    });

    const summary = await worker.tick(new Date("2026-04-01T10:05:00"));
    expect(summary.jobs).toBe(1);
    expect(summary.results).toHaveLength(1);
    expect(summary.failures).toHaveLength(0);
    expect(jobs).toEqual([TARGET_URL]);
    expect(worker.processed()).toBe(1);
  });

  it("retries transient failures and records permanent ones", async () => {
    const scheduler = createScanScheduler();
    scheduler.manual(TARGET_URL);
    let attempts = 0;
    const worker = createScanWorker({
      scheduler,
      runner: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("transient");
        }
        return fakeResult;
      },
      retry: { maxAttempts: 3, baseDelayMs: 1, sleep: async () => undefined },
    });
    const summary = await worker.tick(new Date(NOW));
    expect(summary.results).toHaveLength(1);
    expect(attempts).toBe(3);
  });

  it("does not retry a missing connector", async () => {
    const scheduler = createScanScheduler();
    scheduler.manual(TARGET_URL);
    let attempts = 0;
    const worker = createScanWorker({
      scheduler,
      runner: async () => {
        attempts += 1;
        throw new NoConnectorError(TARGET_URL);
      },
      retry: { maxAttempts: 4, sleep: async () => undefined },
    });
    const summary = await worker.tick(new Date(NOW));
    expect(summary.failures[0]?.message).toMatch(/no connector/);
    expect(attempts).toBe(1);
  });

  it("builds a healing runner from platform dependencies", async () => {
    const { connector } = createFakeConnector();
    const runner = createHealingRunner({
      resolveConnector: (url) => (url === TARGET_URL ? connector : null),
      resolveReport: () => makeReport([META_ISSUE]),
      now: () => NOW,
    });
    const result = await runner({ id: "job_1", scheduleId: null, targetUrl: TARGET_URL, trigger: "manual", dueAt: NOW });
    expect(result.status).toBe("queued");
    expect(result.patchId).toBeTruthy();
  });
});

/* --------------------------------------------------------------- gateway --- */

function setupGateway(
  overrides: Partial<Parameters<typeof createPlatformGateway>[0]> = {}
): { gateway: PlatformGateway; state: FakeState; connector: CmsConnector } {
  const vault = createCredentialVault(Buffer.alloc(32, 7));
  const gateway = createPlatformGateway({ vault, now: () => NOW, ...overrides });
  const { connector, state } = createFakeConnector();
  gateway.connectors.register(TARGET_URL, connector);
  return { gateway, state, connector };
}

describe("Phase 5 — Platform gateway: auth & credentials", () => {
  it("serves an unauthenticated health check", async () => {
    const { gateway } = setupGateway();
    const response = await gateway.handle(request("GET", "/v1/health", { id: "", role: "viewer" }));
    expectStatus(response, 200);
    expect(response.body).toMatchObject({ ok: true });
  });

  it("rejects anonymous and unpermitted requests", async () => {
    const { gateway } = setupGateway();
    const anonymous = await gateway.handle(request("GET", "/v1/events", { id: "", role: "viewer" }));
    expectStatus(anonymous, 401);

    const forbidden = await gateway.handle(
      request("POST", "/v1/credentials", SPECIALIST, {
        platform: "shopify",
        label: "Shop",
        meta: { shop: "example.myshopify.com" },
        secret: { accessToken: "shpat_secret" },
      })
    );
    expectStatus(forbidden, 403);
  });

  it("creates credentials (admin only) and never returns plaintext secrets", async () => {
    const { gateway } = setupGateway();
    const created = await gateway.handle(
      request("POST", "/v1/credentials", ADMIN, {
        platform: "shopify",
        label: "Shop",
        meta: { shop: "example.myshopify.com" },
        secret: { accessToken: "shpat_secret" },
      })
    );
    expectStatus(created, 201);
    const serialized = JSON.stringify(created.body);
    expect(serialized).not.toContain("shpat_secret");
    expect(serialized).toContain("shpa");

    const listed = await gateway.handle(request("GET", "/v1/credentials", SPECIALIST));
    expectStatus(listed, 200);
    expect((listed.body as { credentials: unknown[] }).credentials).toHaveLength(1);
    expect(gateway.auditLog.all().some((entry) => entry.action === "credential.create")).toBe(true);
  });
});

describe("Phase 5 — Platform gateway: patches & deployments", () => {
  it("previews triage and the diff", async () => {
    const { gateway } = setupGateway();
    const response = await gateway.handle(request("POST", "/v1/patches/preview", VIEWER, HIGH_PATCH));
    expectStatus(response, 200);
    const body = response.body as { triage: { overallRisk: string }; diff: unknown[]; requiresApproval: boolean };
    expect(body.triage.overallRisk).toBe("high");
    expect(body.diff).toHaveLength(1);
    expect(body.requiresApproval).toBe(true);
  });

  it("performs a dry run without touching the connector", async () => {
    const { gateway, state } = setupGateway();
    const response = await gateway.handle(
      request("POST", "/v1/deployments", SPECIALIST, { patch: LOW_PATCH, dryRun: true })
    );
    expectStatus(response, 200);
    expect((response.body as { deployment: { status: string } }).deployment.status).toBe("dry_run");
    expect(state.appliedCalls).toBe(0);
  });

  it("deploys an approved low-risk patch and records history + audit", async () => {
    const { gateway, state } = setupGateway();
    const response = await gateway.handle(
      request("POST", "/v1/deployments", SPECIALIST, { patch: LOW_PATCH, approveAll: true })
    );
    expectStatus(response, 200);
    const body = response.body as { deployment: { status: string; applied: number }; historyId: string; snapshotId: string };
    expect(body.deployment.status).toBe("deployed");
    expect(body.deployment.applied).toBe(1);
    expect(body.snapshotId).toBeTruthy();
    expect(state.applied).toHaveLength(1);
    expect(gateway.history.get(body.historyId)?.status).toBe("deployed");
    expect(gateway.auditLog.all().some((entry) => entry.action === "patch.deploy")).toBe(true);
  });

  it("queues a high-risk patch, blocks a specialist approval, then lets an admin approve", async () => {
    const { gateway, state } = setupGateway();
    const queued = await gateway.handle(
      request("POST", "/v1/deployments", SPECIALIST, { patch: HIGH_PATCH })
    );
    expectStatus(queued, 202);
    const approval = (queued.body as { approval: { id: string; status: string } }).approval;
    expect(approval.status).toBe("pending");
    expect(gateway.approvals.pending()).toHaveLength(1);
    expect(state.appliedCalls).toBe(0);

    const blocked = await gateway.handle(
      request("POST", `/v1/approvals/${approval.id}/approve`, SPECIALIST)
    );
    expectStatus(blocked, 403);
    expect(gateway.approvals.get(approval.id)?.status).toBe("pending");

    const approved = await gateway.handle(
      request("POST", `/v1/approvals/${approval.id}/approve`, ADMIN, { note: "ok" })
    );
    expectStatus(approved, 200);
    expect((approved.body as { deployment: { status: string } }).deployment.status).toBe("deployed");
    expect(gateway.approvals.get(approval.id)?.status).toBe("approved");
    expect(state.appliedCalls).toBe(1);
  });

  it("rejects a queued approval", async () => {
    const { gateway } = setupGateway();
    const queued = await gateway.handle(
      request("POST", "/v1/deployments", SPECIALIST, { patch: HIGH_PATCH })
    );
    const approval = (queued.body as { approval: { id: string } }).approval;
    const rejected = await gateway.handle(
      request("POST", `/v1/approvals/${approval.id}/reject`, SPECIALIST, { note: "not now" })
    );
    expectStatus(rejected, 200);
    expect(gateway.approvals.get(approval.id)?.status).toBe("rejected");
    expect(gateway.auditLog.all().some((entry) => entry.action === "patch.reject")).toBe(true);
  });
});

describe("Phase 5 — Platform gateway: history, audit, events, schedules", () => {
  it("lists history and performs one-click undo", async () => {
    const { gateway, state } = setupGateway();
    await gateway.handle(request("POST", "/v1/deployments", SPECIALIST, { patch: LOW_PATCH, approveAll: true }));

    const history = await gateway.handle(request("GET", "/v1/history", VIEWER));
    expectStatus(history, 200);
    const entries = (history.body as { entries: Array<{ id: string; snapshotId: string }> }).entries;
    expect(entries).toHaveLength(1);

    const undone = await gateway.handle(
      request("POST", `/v1/history/${entries[0]!.id}/undo`, SPECIALIST)
    );
    expectStatus(undone, 200);
    expect((undone.body as { entry: { undone: boolean } }).entry.undone).toBe(true);
    expect(state.restored).toBe(true);
    expect(gateway.auditLog.all().some((entry) => entry.action === "history.undo")).toBe(true);
  });

  it("exposes the audit log and verifies its chain", async () => {
    const { gateway } = setupGateway();
    await gateway.handle(request("POST", "/v1/deployments", SPECIALIST, { patch: LOW_PATCH, approveAll: true }));
    const response = await gateway.handle(request("GET", "/v1/audit-log", VIEWER));
    expectStatus(response, 200);
    const body = response.body as { entries: unknown[]; verification: { valid: boolean } };
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.verification.valid).toBe(true);
  });

  it("serves events and manages schedules", async () => {
    const { gateway } = setupGateway();
    const events = await gateway.handle(request("GET", "/v1/events", VIEWER));
    expectStatus(events, 200);

    const created = await gateway.handle(
      request("POST", "/v1/schedules", SPECIALIST, { targetUrl: TARGET_URL, cron: "*/15 * * * *" })
    );
    expectStatus(created, 201);

    const listed = await gateway.handle(request("GET", "/v1/schedules", VIEWER));
    expectStatus(listed, 200);
    expect((listed.body as { schedules: unknown[] }).schedules).toHaveLength(1);

    const invalid = await gateway.handle(
      request("POST", "/v1/schedules", SPECIALIST, { targetUrl: TARGET_URL, cron: "not-a-cron" })
    );
    expectStatus(invalid, 400);
  });

  it("returns 404 for unknown routes", async () => {
    const { gateway } = setupGateway();
    const response = await gateway.handle(request("GET", "/v1/nope", VIEWER));
    expectStatus(response, 404);
  });

  it("enforces the per-principal rate limit with Retry-After", async () => {
    const { gateway } = setupGateway({
      rateLimiter: createRateLimiter({
        defaultConfig: { capacity: 2, refillPerSecond: 0.0001 },
        now: () => 0,
      }),
    });
    expectStatus(await gateway.handle(request("GET", "/v1/events", VIEWER)), 200);
    expectStatus(await gateway.handle(request("GET", "/v1/events", VIEWER)), 200);
    const limited = await gateway.handle(request("GET", "/v1/events", VIEWER));
    expectStatus(limited, 429);
    expect(limited.headers?.["Retry-After"]).toBeDefined();
    expect((limited.body as { error: { code: string } }).error.code).toBe("rate_limited");
  });
});

describe("Phase 5 — Platform gateway: self-healing run", () => {
  it("runs the whole pipeline and verifies against the live page", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 7));
    const { connector, state } = createFakeConnector();
    const gateway = createPlatformGateway({
      vault,
      now: () => NOW,
      fetchImpl: reflectingFetch(state),
    });
    gateway.connectors.register(TARGET_URL, connector);

    const response = await gateway.handle(
      request("POST", "/v1/heal", SPECIALIST, {
        report: makeReport([META_ISSUE]),
        autoPilot: true,
        maxRisk: "low",
      })
    );
    expectStatus(response, 200);
    const body = response.body as { status: string; verification: { httpOk: boolean; domMatches: boolean } };
    expect(body.status).toBe("deployed");
    expect(body.verification.domMatches).toBe(true);
    expect(gateway.history.all()).toHaveLength(1);
    expect(gateway.auditLog.all().some((entry) => entry.action === "healing.run")).toBe(true);
  });

  it("requires admin clearance for approveAll healing", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 7));
    const { connector } = createFakeConnector();
    const gateway = createPlatformGateway({ vault, now: () => NOW });
    gateway.connectors.register(TARGET_URL, connector);

    const response = await gateway.handle(
      request("POST", "/v1/heal", SPECIALIST, {
        report: makeReport([META_ISSUE]),
        approveAll: true,
      })
    );
    expectStatus(response, 403);
  });

  it("404s when no connector is registered for the target", async () => {
    const vault = createCredentialVault(Buffer.alloc(32, 7));
    const gateway = createPlatformGateway({ vault, now: () => NOW });
    const response = await gateway.handle(
      request("POST", "/v1/heal", SPECIALIST, { report: makeReport([META_ISSUE]) })
    );
    expectStatus(response, 404);
  });
});

/* --------------------------------------------------------------- stores ---- */

describe("Phase 5 — In-memory stores", () => {
  it("patch store round-trips patches", () => {
    const store = createPatchStore();
    store.put(LOW_PATCH);
    expect(store.has(LOW_PATCH.patchId)).toBe(true);
    expect(store.get(LOW_PATCH.patchId)).toEqual(LOW_PATCH);
    expect(store.size()).toBe(1);
    store.clear();
    expect(store.size()).toBe(0);
  });

  it("credential store manages records", () => {
    const store = createCredentialStore();
    const credential = {
      id: "c1",
      platform: "wordpress" as const,
      label: "Blog",
      meta: {},
      secret: "sealed",
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.put(credential);
    expect(store.get("c1")).toEqual(credential);
    expect(store.list()).toHaveLength(1);
    expect(store.delete("c1")).toBe(true);
    expect(store.size()).toBe(0);
  });
});