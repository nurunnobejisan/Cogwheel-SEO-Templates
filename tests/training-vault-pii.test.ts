/**
 * Phase B — PII stripping now guards the shared vault, so the app path
 * (which previously persisted captures unredacted) redacts too.
 *
 * `stripTrainingPii` came from the extension copy of `training-vault.ts`
 * (D-016: phone shape shared with `ml/clean/pii.py`); after the merge it is
 * part of `shared/ts/training-vault.ts` and runs inside `saveTrainingPair`
 * for every host.
 */
import { describe, expect, it } from "vitest";
import {
  getTrainingPairByUrl,
  saveTrainingPair,
  stripTrainingPii,
  type RawWebInput,
  type TargetOptimizedOutput,
} from "../shared/ts/training-vault";

const PII_RAW: RawWebInput = {
  url: "https://example.com/contact",
  canonicalUrl: "https://example.com/contact",
  domain: "example.com",
  rawTitle: "Contact the team",
  rawMetaDesc: "Write to jordan@example.com or ring (503) 555 0123.",
  rawH1: ["Contact"],
  rawH2: ["Direct line"],
  rawBodyText:
    "Reach jordan@example.com, key sk-abcdefghij123456, or phone (503) 555 0123 for help.",
  detectedSchemas: [],
  wordCount: 24,
};

const PII_TARGET: TargetOptimizedOutput = {
  optimizedTitle: "Contact the team",
  optimizedMetaDesc: "Reach us at jordan@example.com or (503) 555 0123.",
  optimizedH1: "Contact",
  jsonLdSchema: {
    "@context": "https://schema.org",
    "@type": "ContactPoint",
    email: "jordan@example.com",
  },
  geoEntityBlock: "Call (503) 555 0123.",
  brandGuardrail: "Example",
};

describe("Phase B — shared vault PII stripping", () => {
  it("redacts email, secret and phone shapes recursively", () => {
    const stripped = stripTrainingPii({
      list: ["jordan@example.com", "plain text"],
      nested: { key: "sk-abcdefghij123456" },
      phone: "ring (503) 555 0123 today",
      count: 42,
      flag: true,
    });

    expect(stripped.list).toEqual(["[REDACTED_EMAIL]", "plain text"]);
    expect(stripped.nested.key).toBe("[REDACTED_SECRET]");
    expect(stripped.phone).toBe("ring [REDACTED_PHONE] today");
    expect(stripped.count).toBe(42);
    expect(stripped.flag).toBe(true);
  });

  it("persists a record with no raw PII anywhere in it", async () => {
    const record = await saveTrainingPair({ rawInput: PII_RAW, targetOutput: PII_TARGET });

    const stored = await getTrainingPairByUrl(PII_RAW.canonicalUrl);
    expect(stored?.id).toBe(record.id);

    const blob = JSON.stringify(stored);
    expect(blob).not.toContain("jordan@example.com");
    expect(blob).not.toContain("sk-abcdefghij123456");
    expect(blob).not.toContain("(503) 555 0123");
    expect(blob).toContain("[REDACTED_EMAIL]");
    expect(blob).toContain("[REDACTED_SECRET]");
    expect(blob).toContain("[REDACTED_PHONE]");
    // non-PII content survives untouched
    expect(stored?.rawInput.rawTitle).toBe("Contact the team");
  });
});
