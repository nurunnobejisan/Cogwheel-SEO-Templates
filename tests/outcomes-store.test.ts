import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordChange } from "../src/core/outcomes/record";
import { readChanges, readOutcomes, upsertOutcome } from "../src/core/outcomes/store";
import type { OutcomeRecord } from "../src/core/outcomes";

let dir: string;
let previous: string | undefined;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-studio-outcomes-"));
  previous = process.env.SEO_STUDIO_DATA_DIR;
  process.env.SEO_STUDIO_DATA_DIR = dir;
});

afterAll(async () => {
  if (previous === undefined) delete process.env.SEO_STUDIO_DATA_DIR;
  else process.env.SEO_STUDIO_DATA_DIR = previous;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("outcome store", () => {
  it("records a change once and treats a re-run as a duplicate", async () => {
    const input = {
      pageUrl: "https://example.com/rooms",
      appliedAt: "2026-01-10T12:00:00Z",
      tenantId: "org_1",
    };

    const first = await recordChange(input);
    expect(first.duplicate).toBe(false);

    const second = await recordChange(input);
    expect(second.duplicate).toBe(true);
    expect(second.change.id).toBe(first.change.id);

    const stored = await readChanges();
    expect(stored.filter((entry) => entry.id === first.change.id)).toHaveLength(1);
    expect(stored[0]?.tenantId).toBe("org_1");
  });

  it("upserts outcomes by id (re-measuring replaces, never duplicates)", async () => {
    const base: OutcomeRecord = {
      id: "out_fixed",
      changeId: "chg_test",
      siteUrl: "sc-domain:example.com",
      pageUrl: "https://example.com/rooms",
      measuredAt: "2026-06-30T00:00:00Z",
      provenance: "unavailable",
      reason: "Search Console is not connected",
      windowDays: 28,
      afterComplete: true,
      beforeWindow: { startDate: "2025-12-13", endDate: "2026-01-09" },
      afterWindow: { startDate: "2026-01-13", endDate: "2026-02-09" },
      changed: { before: null, after: null, delta: null },
      control: null,
    };

    await upsertOutcome(base);
    await upsertOutcome({ ...base, provenance: "measured", reason: undefined });

    const stored = await readOutcomes();
    expect(stored.filter((entry) => entry.id === "out_fixed")).toHaveLength(1);
    expect(stored.find((entry) => entry.id === "out_fixed")?.provenance).toBe("measured");
  });
});
