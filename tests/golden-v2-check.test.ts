import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateGoldenV2 } from "../scripts/check-golden-v2";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function makeCase(i: number, task: "schema_generation" | "metadata_generation", overrides: Record<string, unknown> = {}) {
  const url = `https://heldout-hotel-${i}.example/`;
  const domainHash = sha256(`heldout-hotel-${i}.example`).slice(0, 16);
  const output =
    task === "schema_generation"
      ? { "@context": "https://schema.org", "@type": "Hotel", name: `Hotel ${i}` }
      : {
          title: `Hotel ${i} — Official Site`,
          metaDescription: `Book direct at Hotel ${i} for downtown rooms.`,
        };
  return {
    id: sha256(`${task}:${i}:${url}`),
    task,
    input: { url, domainHash, measured: {}, text: `Hotel ${i}` },
    output,
    provenance: "measured",
    source: "wdc-2024",
    licence: "Common Crawl Terms of Use",
    synthetic: false,
    split: "eval",
    createdAt: "2026-11-28T00:00:00.000Z",
    checks: task === "schema_generation" ? ["jsonld_valid"] : ["title_budget"],
    note: `Human reviewed case ${i}`,
    humanReviewed: true,
    ...overrides,
  };
}

describe("WP9 — golden v2 validator and leakage checks", () => {
  it("allows empty scaffolding with --allow-partial and fails strict 75/75 coverage", async () => {
    const partial = await evaluateGoldenV2({ allowPartial: true });
    expect(partial.ok).toBe(true);
    expect(partial.errors).toEqual([]);

    const strict = await evaluateGoldenV2({ allowPartial: false });
    expect(strict.ok).toBe(false);
    expect(strict.errors.some((e) => e.includes("0/75"))).toBe(true);
  });

  it("rejects unreviewed candidates and training host overlap", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "golden-v2-"));
    tempDirs.push(dir);

    const trainFile = path.join(dir, "sft-v2.jsonl");
    writeFileSync(
      trainFile,
      JSON.stringify({
        messages: [
          { role: "system", content: "s" },
          { role: "user", content: "u" },
          { role: "assistant", content: "a" },
        ],
        meta: {
          split: "train",
          hostHash: sha256("heldout-hotel-1.example").slice(0, 16),
          domainHash: sha256("heldout-hotel-1.example").slice(0, 16),
        },
        input: { url: "https://heldout-hotel-1.example/rooms" },
      }) + "\n",
      "utf8",
    );

    const casesPath = path.join(dir, "cases.jsonl");
    writeFileSync(
      casesPath,
      [
        JSON.stringify(makeCase(1, "schema_generation", { humanReviewed: true })),
        JSON.stringify(makeCase(2, "metadata_generation", { humanReviewed: false })),
      ].join("\n") + "\n",
      "utf8",
    );

    const res = await evaluateGoldenV2({ casesPath, trainFilePath: trainFile, allowPartial: true });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("overlaps with training split"))).toBe(true);
    expect(res.errors.some((e) => e.includes("humanReviewed: true"))).toBe(true);
  });

  it("passes strict gate when >= 75 schema and >= 75 metadata reviewed non-overlapping cases exist", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "golden-v2-full-"));
    tempDirs.push(dir);

    const rows: string[] = [];
    for (let i = 0; i < 75; i += 1) {
      rows.push(JSON.stringify(makeCase(i, "schema_generation")));
      rows.push(JSON.stringify(makeCase(i + 1000, "metadata_generation")));
    }
    const casesPath = path.join(dir, "cases.jsonl");
    writeFileSync(casesPath, rows.join("\n") + "\n", "utf8");

    const res = await evaluateGoldenV2({ casesPath, allowPartial: false });
    expect(res.ok).toBe(true);
    expect(res.counts.schema_generation).toBe(75);
    expect(res.counts.metadata_generation).toBe(75);
  });
});
