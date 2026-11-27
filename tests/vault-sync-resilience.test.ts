/**
 * Task 1.3 — Vault migration, contentHash dedupe/versioning, and sync client
 * resilience (exponential backoff + idempotency) tests.
 *
 * Covers the three gaps left by tests/training-vault*.test.ts and
 * tests/dataset-builder.test.ts:
 *   1. migrateRecordToV3 — v1/v2 legacy records conforming to the v3.0 schema.
 *   2. contentHash versioning — identical content dedupes (version unchanged),
 *      changed content increments version, status survives re-capture.
 *   3. syncRecordToApi — exponential backoff on 5xx/network errors, fast-fail
 *      on 4xx (except 429), retry exhaustion, and stable idempotency keys.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  migrateRecordToV3,
  saveTrainingPair,
  getTrainingPairByUrl,
  getAllTrainingPairs,
  clearTrainingVault,
  updateTrainingPairStatus,
  RawWebInput,
  TargetOptimizedOutput,
  TrainingPairRecord,
} from "../src/storage/training-vault";
import {
  syncRecordToApi,
  syncBatchToApi,
  recordToRawJsonl,
  ApiSyncConfig,
} from "../src/engine/dataset-builder";

const baseRawInput: RawWebInput = {
  url: "https://www.hilton.com/hotel/denver-downtown/",
  canonicalUrl: "https://www.hilton.com/hotel/denver-downtown/",
  domain: "www.hilton.com",
  rawTitle: "Hilton Denver Downtown | Hotels in Denver, CO",
  rawMetaDesc: "Stay at Hilton Denver Downtown, steps from the Colorado Convention Center.",
  rawH1: ["Hilton Denver Downtown"],
  rawH2: ["Rooms & Suites", "Dining"],
  rawBodyText:
    "The Hilton Denver Downtown offers modern rooms near the convention center with mountain views.",
  detectedSchemas: ["Hotel", "BreadcrumbList"],
  wordCount: 240,
};

const baseTargetOutput: TargetOptimizedOutput = {
  optimizedTitle: "Hilton Denver Downtown Hotel | Book Direct",
  optimizedMetaDesc:
    "Book your stay at Hilton Denver Downtown near the Colorado Convention Center. Enjoy modern rooms, on-site dining and direct-booking rates in the heart of Denver.",
  optimizedH1: "Hilton Denver Downtown",
  jsonLdSchema: {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Hilton Denver Downtown",
  },
  geoEntityBlock:
    "Hilton Denver Downtown is a hotel in Denver, Colorado, located near the Colorado Convention Center at 1701 California St.",
  brandGuardrail: "Hilton",
};

const syncConfig: ApiSyncConfig = {
  endpointUrl: "https://api.example.test/v1/training-pairs",
  bearerToken: "test-token",
  maxRetries: 2,
};

function jsonResponse(status: number, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

describe("Task 1.3 — Vault Migration (v1/v2 → v3.0)", () => {
  it("migrates a bare v1 record (no schemaVersion, no tier) to the v3.0 schema", () => {
    const v1Record = {
      id: "legacy_id_1",
      canonicalUrl: "https://www.marriott.com/hotels/travel/ecpsb/",
      domain: "www.marriott.com",
      rawInput: { ...baseRawInput, domain: "www.marriott.com" },
      targetOutput: baseTargetOutput,
    };

    const migrated = migrateRecordToV3(v1Record);

    expect(migrated.schemaVersion).toBe("3.0.0");
    expect(migrated.tier).toBe("raw");
    expect(migrated.id).toBe("legacy_id_1");
    expect(migrated.canonicalUrlHash).toBe("legacy_id_1");
    // v1 records had no contentHash — fall back to the URL hash so dedupe works.
    expect(migrated.contentHash).toBe("legacy_id_1");
    expect(migrated.version).toBe(1);
    expect(migrated.source).toBe("manual");
    expect(migrated.status).toBe("pending");
    expect(migrated.brand).toBe("Independent");
    expect(migrated.qualityScore).toBe(75);
    // No pageType on v1 records → classifyPageType derives it; the fixture
    // body mentions "rooms", so it lands on landing_page.
    expect(migrated.pageType).toBe("landing_page");
    expect(migrated.createdAt).toBeTruthy();
    expect(migrated.updatedAt).toBeTruthy();
  });

  it("migrates a v2 record with partial fields, preserving known values", () => {
    const v2Record = {
      id: "v2_id_9",
      canonicalUrlHash: "v2_id_9",
      canonicalUrl: "https://www.hilton.com/hotel/denver-downtown/rooms/",
      contentHash: "ch_v2_existing",
      version: 3,
      source: "auto",
      pageType: "room_details",
      extractionConfidence: 88,
      brand: "Hilton",
      qualityScore: 91,
      status: "approved",
      createdAt: "2026-01-15T08:00:00.000Z",
      updatedAt: "2026-01-16T09:30:00.000Z",
      rawInput: { ...baseRawInput, url: "https://www.hilton.com/hotel/denver-downtown/rooms/" },
      targetOutput: baseTargetOutput,
    };

    const migrated = migrateRecordToV3(v2Record);

    expect(migrated.schemaVersion).toBe("3.0.0");
    expect(migrated.tier).toBe("raw");
    // Known v2 fields survive migration untouched.
    expect(migrated.contentHash).toBe("ch_v2_existing");
    expect(migrated.version).toBe(3);
    expect(migrated.source).toBe("auto");
    expect(migrated.pageType).toBe("room_details");
    expect(migrated.extractionConfidence).toBe(88);
    expect(migrated.brand).toBe("Hilton");
    expect(migrated.qualityScore).toBe(91);
    expect(migrated.status).toBe("approved");
    expect(migrated.createdAt).toBe("2026-01-15T08:00:00.000Z");
    expect(migrated.updatedAt).toBe("2026-01-16T09:30:00.000Z");
  });

  it("passes an already-v3 record through unchanged", () => {
    const v3Record: TrainingPairRecord = {
      id: "v3_id_1",
      schemaVersion: "3.0.0",
      tier: "raw",
      pack: "hotel",
      canonicalUrlHash: "v3_id_1",
      contentHash: "ch_v3",
      version: 2,
      source: "manual",
      pageType: "article",
      extractionConfidence: 70,
      canonicalUrl: "https://www.hilton.com/blog/",
      domain: "www.hilton.com",
      brand: "Hilton",
      rawInput: baseRawInput,
      targetOutput: baseTargetOutput,
      qualityScore: 80,
      scoreBreakdown: {
        completeness: 25,
        optimizationDelta: 20,
        geoEntityDepth: 15,
        schemaValidity: 20,
      },
      status: "rejected",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };

    const migrated = migrateRecordToV3(v3Record);

    expect(migrated).toEqual(v3Record);
  });

  it("fills missing scoreBreakdown on legacy records with a valid v3 breakdown", () => {
    const legacy = {
      id: "legacy_no_breakdown",
      canonicalUrl: "https://example.com/",
      rawInput: baseRawInput,
      targetOutput: baseTargetOutput,
    };

    const migrated = migrateRecordToV3(legacy);
    const sum =
      migrated.scoreBreakdown.completeness +
      migrated.scoreBreakdown.optimizationDelta +
      migrated.scoreBreakdown.geoEntityDepth +
      migrated.scoreBreakdown.schemaValidity;

    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThanOrEqual(100);
  });
});

describe("Task 1.3 — contentHash versioning & dedupe", () => {
  beforeEach(async () => {
    await clearTrainingVault();
  });

  it("dedupes re-capture of identical content (version stays 1, single record)", async () => {
    const first = await saveTrainingPair({
      rawInput: baseRawInput,
      targetOutput: baseTargetOutput,
    });
    const second = await saveTrainingPair({
      rawInput: { ...baseRawInput },
      targetOutput: { ...baseTargetOutput },
    });

    expect(second.id).toBe(first.id);
    expect(second.version).toBe(1);
    expect(second.contentHash).toBe(first.contentHash);

    const all = await getAllTrainingPairs();
    expect(all).toHaveLength(1);
  });

  it("increments version when page content changes but keeps the record id", async () => {
    const first = await saveTrainingPair({
      rawInput: baseRawInput,
      targetOutput: baseTargetOutput,
    });

    const changedRaw: RawWebInput = {
      ...baseRawInput,
      rawTitle: "Completely Rewritten Denver Hotel Title For Version Bump Test",
      rawMetaDesc: "A rewritten meta description that changes the content fingerprint.",
    };
    const second = await saveTrainingPair({
      rawInput: changedRaw,
      targetOutput: baseTargetOutput,
    });

    expect(second.id).toBe(first.id); // same canonical URL → same primary key
    expect(second.contentHash).not.toBe(first.contentHash);
    expect(second.version).toBe(first.version + 1);
    expect(await getAllTrainingPairs()).toHaveLength(1);
  });

  it("treats URL variants (protocol, trailing slash, case) as the same record", async () => {
    await saveTrainingPair({ rawInput: baseRawInput, targetOutput: baseTargetOutput });
    await saveTrainingPair({
      rawInput: {
        ...baseRawInput,
        url: "http://WWW.hilton.com/hotel/denver-downtown///",
        canonicalUrl: "http://www.hilton.com/hotel/denver-downtown",
      },
      targetOutput: baseTargetOutput,
    });

    const all = await getAllTrainingPairs();
    expect(all).toHaveLength(1);
  });

  it("preserves approval status across a content re-capture", async () => {
    const saved = await saveTrainingPair({
      rawInput: baseRawInput,
      targetOutput: baseTargetOutput,
    });
    await updateTrainingPairStatus(saved.id, "approved");

    const recaptured = await saveTrainingPair({
      rawInput: { ...baseRawInput, rawTitle: "Updated Title After Approval Triggers Version Bump" },
      targetOutput: baseTargetOutput,
    });

    expect(recaptured.status).toBe("approved");
    expect(recaptured.version).toBe(2);
  });

  it("lookup by URL finds the deduped record", async () => {
    await saveTrainingPair({ rawInput: baseRawInput, targetOutput: baseTargetOutput });
    const found = await getTrainingPairByUrl("https://www.hilton.com/hotel/denver-downtown/");
    expect(found).not.toBeNull();
    expect(found?.domain).toBe("www.hilton.com");
  });
});

describe("Task 1.3 — Sync client exponential backoff & idempotency", () => {
  const record: TrainingPairRecord = {
    id: "sync_hash_1",
    schemaVersion: "3.0.0",
    tier: "raw",
    pack: "hotel",
    canonicalUrlHash: "sync_hash_1",
    contentHash: "ch_sync_1",
    version: 1,
    source: "manual",
    pageType: "hotel_homepage",
    extractionConfidence: 95,
    canonicalUrl: "https://www.hilton.com/hotel/denver-downtown/",
    domain: "www.hilton.com",
    brand: "Hilton",
    rawInput: baseRawInput,
    targetOutput: baseTargetOutput,
    qualityScore: 90,
    scoreBreakdown: {
      completeness: 30,
      optimizationDelta: 30,
      geoEntityDepth: 15,
      schemaValidity: 15,
    },
    status: "approved",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };

  it("retries after 500 and succeeds on a later attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, "upstream exploded"))
      .mockResolvedValueOnce(jsonResponse(502, "bad gateway"))
      .mockResolvedValueOnce(jsonResponse(200, "ok"));

    const result = await syncRecordToApi(record, syncConfig, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx client errors (except 429)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(422, "validation failed"));

    const result = await syncRecordToApi(record, syncConfig, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(false);
    expect(result.status).toBe(422);
    expect(mockFetch).toHaveBeenCalledTimes(1); // fast-fail, no backoff loop
  });

  it("retries on 429 rate limiting", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, "slow down"))
      .mockResolvedValueOnce(jsonResponse(200, "ok"));

    const result = await syncRecordToApi(record, syncConfig, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries when the network throws, then succeeds", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(201, "created"));

    const result = await syncRecordToApi(record, syncConfig, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries with a descriptive error", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(503, "service unavailable"));

    const result = await syncRecordToApi(
      record,
      { ...syncConfig, maxRetries: 1 },
      mockFetch as unknown as typeof fetch
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toContain("Exceeded max retries (1)");
    expect(result.error).toContain("service unavailable");
    // initial attempt + 1 retry
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("sends a stable idempotency key derived from url hash + content hash + version", () => {
    const a = recordToRawJsonl(record);
    const b = recordToRawJsonl({ ...record });

    expect(a.idempotencyKey).toBe(`sync_hash_1_ch_sync_1_1`);
    expect(b.idempotencyKey).toBe(a.idempotencyKey); // deterministic across calls

    const bumped = recordToRawJsonl({ ...record, version: 2 });
    expect(bumped.idempotencyKey).not.toBe(a.idempotencyKey);

    const recaptured = recordToRawJsonl({ ...record, contentHash: "ch_sync_2" });
    expect(recaptured.idempotencyKey).not.toBe(a.idempotencyKey);
  });

  it("fails the whole batch fast when the endpoint is not configured", async () => {
    const mockFetch = vi.fn();
    const summary = await syncBatchToApi(
      [record, { ...record, id: "sync_hash_2" }],
      { ...syncConfig, endpointUrl: "   " },
      mockFetch as unknown as typeof fetch
    );

    expect(summary.successful).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.errors[0]).toContain("not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
