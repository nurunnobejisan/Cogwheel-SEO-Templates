/**
 * Human review queue tests (v2 WP1).
 *
 * Covers the hard rules the queue exists to enforce:
 *   - no auth → 401 on every route handler;
 *   - only an authenticated operator decision sets reviewed: true;
 *   - a rejected row never becomes a train row (excluded from every export
 *     and never flipped to a training-eligible triple tier);
 *   - edit-and-approve keeps the original candidate output as provenance.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  decideRow,
  isTrainEligible,
  ReviewRowError,
  type ReviewRow,
} from "../src/core/review/queue";
import {
  exportApproved,
  GOLDEN_CANDIDATES_FILE,
  listQueue,
  recordDecision,
  QUEUE_FILE,
  SHADOW_DISAGREEMENTS_FILE,
  syncQueue,
  TRIPLES_FILE,
} from "../src/lib/review/store";
import { GET as queueGet, POST as queuePost } from "../src/app/api/review-queue/route";

let dataDir: string;

function seedDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "review-queue-"));
}

function rowFixture(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: "rq_test_row",
    source: "shadow_disagreement",
    task: "metadata_generation",
    input: { pageType: "hotel_homepage", text: "Hotel Aurora, 12 rooms." },
    candidateOutput: { title: "Hotel Aurora | Book Direct" },
    gateResults: [{ gate: "invented_metrics", passed: true }],
    sourceLicence: "Own",
    enqueuedAt: "2026-11-29T00:00:00.000Z",
    reviewed: false,
    ...overrides,
  };
}

async function seedQueueFile(rows: unknown[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(dataDir, QUEUE_FILE),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8",
  );
}

type RouteRequest = Parameters<typeof queueGet>[0];

function getRequest(url = "http://localhost/api/review-queue", headers: Record<string, string> = {}): RouteRequest {
  return new Request(url, { headers }) as unknown as RouteRequest;
}

function postRequest(body: unknown, headers: Record<string, string> = {}): RouteRequest {
  return new Request("http://localhost/api/review-queue", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as RouteRequest;
}

/** Authenticated operator headers via the documented local dev fallback. */
const OPERATOR_HEADERS = { cookie: "cw_actor_id=op-1; cw_actor_role=admin" };

beforeEach(async () => {
  dataDir = seedDir();
  process.env.SEO_STUDIO_DATA_DIR = dataDir;
  process.env.PLATFORM_DEV_AUTH = "1";
  delete process.env.PLATFORM_SESSION_SECRET;
});

afterEach(async () => {
  delete process.env.SEO_STUDIO_DATA_DIR;
  delete process.env.PLATFORM_DEV_AUTH;
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("review queue core invariants", () => {
  it("approve marks the row eligible with the candidate as output", () => {
    const row = rowFixture();
    const decided = decideRow(row, { action: "approve", reviewer: "op-1" });
    expect(decided.reviewed).toBe(true);
    expect(decided.decision).toBe("approved");
    expect(decided.output).toEqual(row.candidateOutput);
    expect(isTrainEligible(decided)).toBe(true);
  });

  it("reject never becomes a train row", () => {
    const decided = decideRow(rowFixture(), { action: "reject", reviewer: "op-1", reason: "hallucinated phone" });
    expect(decided.decision).toBe("rejected");
    expect(isTrainEligible(decided)).toBe(false);
  });

  it("edit_and_approve keeps the original candidate as provenance", () => {
    const row = rowFixture();
    const edited = { title: "Hotel Aurora | Official Site" };
    const decided = decideRow(row, {
      action: "edit_and_approve",
      reviewer: "op-1",
      editedOutput: edited,
    });
    expect(decided.decision).toBe("approved");
    expect(decided.output).toEqual(edited);
    expect(decided.originalOutput).toEqual(row.candidateOutput);
  });

  it("refuses a second decision — decisions are immutable", () => {
    const decided = decideRow(rowFixture(), { action: "approve", reviewer: "op-1" });
    expect(() => decideRow(decided, { action: "reject", reviewer: "op-1" })).toThrow(ReviewRowError);
  });

  it("refuses anonymous decisions — only a human operator sets reviewed: true", () => {
    expect(() => decideRow(rowFixture(), { action: "approve", reviewer: "" })).toThrow(ReviewRowError);
    expect(() => decideRow(rowFixture(), { action: "approve", reviewer: "   " })).toThrow(ReviewRowError);
  });

  it("edit_and_approve without an edited output is refused", () => {
    expect(() => decideRow(rowFixture(), { action: "edit_and_approve", reviewer: "op-1" })).toThrow(
      ReviewRowError,
    );
  });
});

describe("review queue store", () => {
  it("syncs raw triples and producer rows into the unified queue", async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const triple = {
      id: "triple_1",
      url: "https://example.com/",
      audit: { findings: ["missing meta description"] },
      expertFix: { metaDescription: "Hotel Aurora — 12 rooms in Bergen." },
      quality: "raw",
      capturedAt: "2026-11-28T00:00:00.000Z",
      contentHash: "abc",
      consent: true,
      provenance: "measured",
      pack: "hotel",
      pageType: "hotel_homepage",
    };
    await fs.writeFile(
      path.join(dataDir, TRIPLES_FILE),
      `${JSON.stringify(triple)}\n`,
      "utf8",
    );
    const golden = rowFixture({
      id: "rq_golden_1",
      source: "golden_candidate",
      task: "schema_generation",
    });
    await fs.mkdir(path.join(dataDir, "ml-review"), { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "ml-review", "golden-candidates.jsonl"),
      `${JSON.stringify(golden)}\n`,
      "utf8",
    );

    const snapshot = await listQueue();
    expect(snapshot.rows).toHaveLength(2);
    const sources = snapshot.rows.map((row) => row.source).sort();
    expect(sources).toEqual(["golden_candidate", "teacher_triple"]);

    // Idempotent: a second sync does not duplicate rows.
    const again = await syncQueue();
    expect(again.enqueued).toBe(0);
  });

  it("approving a teacher triple flips it to the reviewed tier", async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const triple = {
      id: "triple_2",
      url: "https://example.com/rooms",
      audit: { findings: [] },
      expertFix: { title: "Rooms & Suites | Hotel Aurora" },
      quality: "raw",
      capturedAt: "2026-11-28T00:00:00.000Z",
      contentHash: "def",
      consent: true,
      provenance: "measured",
      pack: "hotel",
      pageType: "room_details",
    };
    await fs.writeFile(
      path.join(dataDir, TRIPLES_FILE),
      `${JSON.stringify(triple)}\n`,
      "utf8",
    );
    const { rows } = await listQueue();
    const teacherRow = rows.find((row) => row.source === "teacher_triple");
    expect(teacherRow).toBeDefined();

    const decided = await recordDecision({
      id: teacherRow!.id,
      action: "approve",
      reviewer: "op-1",
    });
    expect(decided.reviewed).toBe(true);

    const stored = await fs.readFile(path.join(dataDir, TRIPLES_FILE), "utf8");
    expect(JSON.parse(stored)).toMatchObject({ quality: "reviewed", reviewedBy: "op-1" });
  });

  it("a rejected triple stays raw and is excluded from every export", async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const triple = {
      id: "triple_3",
      url: "https://example.com/spa",
      audit: { findings: [] },
      expertFix: { title: "Invented phone +1 555 000 0000" },
      quality: "raw",
      capturedAt: "2026-11-28T00:00:00.000Z",
      contentHash: "ghi",
      consent: true,
      provenance: "measured",
      pack: "hotel",
      pageType: "spa",
    };
    await fs.writeFile(
      path.join(dataDir, TRIPLES_FILE),
      `${JSON.stringify(triple)}\n`,
      "utf8",
    );
    const shadow = rowFixture({ id: "rq_shadow_rej" });
    await fs.mkdir(path.join(dataDir, "ml-review"), { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "ml-review", "shadow-disagreements.jsonl"),
      `${JSON.stringify(shadow)}\n`,
      "utf8",
    );

    const { rows } = await listQueue();
    for (const row of rows) {
      await recordDecision({ id: row.id, action: "reject", reviewer: "op-1", reason: "bad" });
    }

    for (const format of ["sft", "dpo", "golden"] as const) {
      const exported = await exportApproved(format);
      expect(exported).toBe("");
    }
    const stored = JSON.parse(await fs.readFile(path.join(dataDir, TRIPLES_FILE), "utf8")) as {
      quality: string;
    };
    expect(stored.quality).toBe("raw");
  });

  it("exports approved rows in the consumer formats with provenance kept", async () => {
    const golden = rowFixture({
      id: "rq_golden_ok",
      source: "golden_candidate",
      task: "schema_generation",
      candidateOutput: { "@type": "Hotel", name: "Hotel Aurora" },
    });
    const shadow = rowFixture({
      id: "rq_shadow_ok",
      source: "shadow_disagreement",
      task: "metadata_generation",
    });
    await seedQueueFile([golden, shadow]);

    await recordDecision({ id: "rq_golden_ok", action: "approve", reviewer: "op-1" });
    await recordDecision({
      id: "rq_shadow_ok",
      action: "edit_and_approve",
      reviewer: "op-1",
      editedOutput: { title: "Hotel Aurora | Official Site" },
      reason: "tighter title",
    });

    const dpo = await exportApproved("dpo");
    const dpoRow = JSON.parse(dpo.trim()) as {
      prompt: string;
      chosen: unknown;
      rejected: unknown;
    };
    expect(dpoRow.chosen).toEqual({ title: "Hotel Aurora | Official Site" });
    expect(dpoRow.rejected).toEqual(shadow.candidateOutput);

    const goldenOut = JSON.parse((await exportApproved("golden")).trim()) as {
      id: string;
      source: string;
      synthetic: boolean;
      split: string;
      note: string;
    };
    expect(goldenOut.id).toMatch(/^[0-9a-f]{64}$/);
    expect(goldenOut.source).toBe("review_queue");
    expect(goldenOut.synthetic).toBe(false);

    // SFT export contains only approved teacher triples — none here.
    expect(await exportApproved("sft")).toBe("");
  });

  it("rejects a decision on an unknown row", async () => {
    await seedQueueFile([]);
    await expect(recordDecision({ id: "nope", action: "approve", reviewer: "op-1" })).rejects.toThrow(
      /not found/,
    );
  });
});

describe("review queue API auth", () => {
  it("GET without auth returns 401", async () => {
    const res = await queueGet(getRequest());
    expect(res.status).toBe(401);
  });

  it("GET export without auth returns 401", async () => {
    const res = await queueGet(getRequest("http://localhost/api/review-queue?format=sft"));
    expect(res.status).toBe(401);
  });

  it("POST without auth returns 401 and never records a decision", async () => {
    await seedQueueFile([rowFixture()]);
    const res = await queuePost(postRequest({ id: "rq_test_row", action: "approve" }));
    expect(res.status).toBe(401);
    const rows = await listQueue();
    expect(rows.rows[0].reviewed).toBe(false);
  });

  it("POST with an operator session records the decision", async () => {
    await seedQueueFile([rowFixture({ id: "rq_auth_ok" })]);
    const res = await queuePost(
      postRequest({ id: "rq_auth_ok", action: "approve" }, OPERATOR_HEADERS),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { row: { reviewed: boolean; reviewer: string } };
    expect(json.row.reviewed).toBe(true);
    expect(json.row.reviewer).toBe("op-1");
  });

  it("POST an invalid action returns 400", async () => {
    await seedQueueFile([rowFixture({ id: "rq_bad_action" })]);
    const res = await queuePost(
      postRequest({ id: "rq_bad_action", action: "auto_approve_everything" }, OPERATOR_HEADERS),
    );
    expect(res.status).toBe(400);
  });

  it("POST export endpoint returns approved rows as ndjson for the golden checker", async () => {
    const golden = rowFixture({
      id: "rq_export_ok",
      source: "golden_candidate",
      task: "metadata_generation",
    });
    await seedQueueFile([golden]);
    await recordDecision({ id: "rq_export_ok", action: "approve", reviewer: "op-1" });
    const res = await queueGet(
      getRequest("http://localhost/api/review-queue?format=golden", OPERATOR_HEADERS),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const parsed = JSON.parse(text.trim()) as { id: string };
    expect(parsed.id).toMatch(/^[0-9a-f]{64}$/);
  });
});
