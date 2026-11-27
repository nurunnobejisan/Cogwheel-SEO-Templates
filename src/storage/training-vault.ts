/**
 * SEO & GEO Studio - Training Data Vault (IndexedDB Store) v3.0
 *
 * Implements a persistent, client-side dataset repository for fine-tuning
 * and Generative Engine Optimization. Automatically pairs raw webpage DOM snapshots
 * with optimized targets (Title, Meta Description, JSON-LD, and GEO entity blocks),
 * computes dataset quality scores (0-100), extraction confidence (0-100),
 * classifies pageType, tracks contentHash versioning, and deduplicates by canonical URL.
 */

export interface RawWebInput {
  url: string;
  canonicalUrl: string;
  domain: string;
  rawTitle: string;
  rawMetaDesc: string;
  rawH1: string[];
  rawH2: string[];
  rawBodyText: string;
  detectedSchemas: string[];
  wordCount: number;
}

export interface TargetOptimizedOutput {
  optimizedTitle: string;
  optimizedMetaDesc: string;
  optimizedH1: string;
  jsonLdSchema: Record<string, unknown> | Array<Record<string, unknown>>;
  geoEntityBlock: string;
  brandGuardrail: string;
}

export interface TrainingScoreBreakdown {
  completeness: number; // 0 - 30
  optimizationDelta: number; // 0 - 30
  geoEntityDepth: number; // 0 - 20
  schemaValidity: number; // 0 - 20
}

export type TrainingRecordStatus = "pending" | "approved" | "rejected";
export type TrainingSourceType = "auto" | "manual";
export type PageTypeLabel =
  | "hotel_homepage"
  | "room_details"
  | "amenities"
  | "booking"
  | "location"
  | "article"
  | "landing_page"
  | "other"
  // Additive Phase 4 labels (D-008) — superset converges with
  // `MlPageTypeLabels` in schemas/ml-example.ts. Never remove a member:
  // old IndexedDB records keep their original values either way.
  | "dining"
  | "spa"
  | "offers"
  | "meetings_events"
  | "faq"
  | "gallery"
  | "contact";

export interface TrainingPairRecord {
  id: string; // Unique primary key derived from canonical URL hash
  schemaVersion: "3.0.0";
  /** Captures always start in the raw tier; reviewed/gold is set server-side. */
  tier: "raw";
  canonicalUrlHash: string;
  contentHash: string; // Content fingerprint hash for versioning & deduplication
  version: number;
  source: TrainingSourceType;
  pageType: PageTypeLabel;
  extractionConfidence: number; // 0 - 100
  canonicalUrl: string;
  domain: string;
  brand: string;
  rawInput: RawWebInput;
  targetOutput: TargetOptimizedOutput;
  qualityScore: number; // 0 - 100
  scoreBreakdown: TrainingScoreBreakdown;
  status: TrainingRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingVaultStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  avgQualityScore: number;
}

export const DB_NAME = "CogwheelTrainingVaultDB";
export const DB_VERSION = 3;
export const STORE_NAME = "training_samples";

/**
 * Generates a deterministic hash for a canonical URL to prevent duplicate training records.
 */
export async function computeCanonicalHash(canonicalUrl: string): Promise<string> {
  const normalized = (canonicalUrl || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(normalized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    } catch {
      // Fallback
    }
  }

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "hash_" + (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Computes a deterministic content hash of page content for version tracking.
 */
export async function computeContentHash(content: string): Promise<string> {
  const normalized = (content || "").trim().replace(/\s+/g, " ");
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(normalized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return "ch_" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
    } catch {
      // Fallback
    }
  }

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "ch_" + (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Automatically classifies the hotel pageType.
 */
export function classifyPageType(url: string, raw: RawWebInput): PageTypeLabel {
  const lowerUrl = (url || "").toLowerCase();
  const lowerBody = (raw.rawBodyText || "").toLowerCase();

  // Additive Phase 4 labels (D-008): checked before the broader hotel rules
  // so a specific URL gets the specific label. Existing labels below are
  // untouched for URLs they already claimed.
  if (
    lowerUrl.includes("/dining") ||
    lowerUrl.includes("/restaurant") ||
    lowerUrl.includes("/menu")
  ) {
    return "dining";
  }
  if (lowerUrl.includes("/spa") || lowerUrl.includes("/wellness")) {
    return "spa";
  }
  if (lowerUrl.includes("/contact")) {
    return "contact";
  }
  if (lowerUrl.includes("/faq") || lowerUrl.includes("/faqs")) {
    return "faq";
  }
  if (lowerUrl.includes("/gallery") || lowerUrl.includes("/photos")) {
    return "gallery";
  }
  if (
    lowerUrl.includes("/offers") ||
    lowerUrl.includes("/deals") ||
    lowerUrl.includes("/specials")
  ) {
    return "offers";
  }
  if (
    lowerUrl.includes("/meetings") ||
    lowerUrl.includes("/events") ||
    lowerUrl.includes("/weddings")
  ) {
    return "meetings_events";
  }

  if (lowerUrl.includes("/rooms") || lowerUrl.includes("/suites") || lowerUrl.includes("guest-rooms")) {
    return "room_details";
  }
  if (lowerUrl.includes("/amenities") || lowerUrl.includes("/pool")) {
    return "amenities";
  }
  if (lowerUrl.includes("/reservation") || lowerUrl.includes("/book") || lowerUrl.includes("/checkout")) {
    return "booking";
  }
  if (lowerUrl.includes("/location") || lowerUrl.includes("/map") || lowerUrl.includes("/directions")) {
    return "location";
  }
  if (lowerUrl.includes("/blog") || lowerUrl.includes("/article") || lowerUrl.includes("/guide")) {
    return "article";
  }
  try {
    const p = new URL(url).pathname;
    if (p === "/" || p === "" || p.endsWith("/index.html")) {
      return "hotel_homepage";
    }
  } catch {
    if (!url.includes("/") || url.endsWith(".com") || url.endsWith(".org")) {
      return "hotel_homepage";
    }
  }

  if (lowerBody.includes("room") || lowerBody.includes("bed") || lowerBody.includes("rate")) {
    return "landing_page";
  }

  return "hotel_homepage";
}

/**
 * Computes extraction confidence score (0-100).
 */
export function computeExtractionConfidence(raw: RawWebInput): number {
  let score = 0;
  if (raw.rawTitle && raw.rawTitle.length >= 10) score += 20;
  if (raw.rawMetaDesc && raw.rawMetaDesc.length >= 20) score += 20;
  if (raw.rawH1 && raw.rawH1.length >= 1) score += 20;
  if (raw.wordCount && raw.wordCount >= 100) score += 20;
  if (raw.detectedSchemas && raw.detectedSchemas.length >= 1) score += 10;
  if (raw.canonicalUrl) score += 10;
  return Math.min(100, score);
}

/**
 * Computes a standardized dataset quality score (0 - 100) for a training sample.
 */
export function computeDatasetQualityScore(
  raw: RawWebInput,
  target: TargetOptimizedOutput
): { qualityScore: number; breakdown: TrainingScoreBreakdown } {
  let completeness = 0;
  let optimizationDelta = 0;
  let geoEntityDepth = 0;
  let schemaValidity = 0;

  // 1. Completeness (max 30 pts)
  if (raw.rawTitle.trim().length > 0) completeness += 5;
  if (raw.rawMetaDesc.trim().length > 0) completeness += 5;
  if (raw.rawBodyText.trim().length > 50) completeness += 5;
  if (target.optimizedTitle.trim().length > 0) completeness += 5;
  if (target.optimizedMetaDesc.trim().length > 0) completeness += 5;
  if (target.optimizedH1.trim().length > 0) completeness += 5;

  // 2. Optimization Quality Delta (max 30 pts)
  const tLen = target.optimizedTitle.length;
  if (tLen >= 45 && tLen <= 65) {
    optimizationDelta += 12;
  } else if (tLen > 0 && tLen <= 75) {
    optimizationDelta += 6;
  }

  const mLen = target.optimizedMetaDesc.length;
  if (mLen >= 120 && mLen <= 160) {
    optimizationDelta += 12;
  } else if (mLen > 0 && mLen <= 180) {
    optimizationDelta += 6;
  }

  if (target.optimizedH1.length > 0 && target.optimizedH1.length <= 70) {
    optimizationDelta += 6;
  }

  // 3. GEO Entity Depth (max 20 pts)
  const geoText = target.geoEntityBlock.trim();
  if (geoText.length >= 150) {
    geoEntityDepth += 20;
  } else if (geoText.length >= 50) {
    geoEntityDepth += 10;
  }

  // 4. Schema Validity (max 20 pts)
  if (target.jsonLdSchema) {
    if (Array.isArray(target.jsonLdSchema) && target.jsonLdSchema.length > 0) {
      schemaValidity += 20;
    } else if (typeof target.jsonLdSchema === "object" && Object.keys(target.jsonLdSchema).length > 0) {
      schemaValidity += 20;
    }
  }

  const qualityScore = completeness + optimizationDelta + geoEntityDepth + schemaValidity;

  return {
    qualityScore,
    breakdown: {
      completeness,
      optimizationDelta,
      geoEntityDepth,
      schemaValidity,
    },
  };
}

// In-Memory Fallback Store for non-browser / test environments
const inMemoryVault = new Map<string, TrainingPairRecord>();

/**
 * Migration helper to ensure legacy records conform to v3.0 schema.
 * Exported for resilience tests (see tests/vault-sync-resilience.test.ts).
 */
export function migrateRecordToV3(rawRecord: unknown): TrainingPairRecord {
  const r = rawRecord as Record<string, unknown>;
  const rawInput = (r.rawInput || {}) as RawWebInput;
  const canonicalUrl = (r.canonicalUrl as string) || (rawInput.url as string) || "";
  const canonicalUrlHash = (r.canonicalUrlHash as string) || (r.id as string) || "hash_legacy";

  return {
    id: (r.id as string) || canonicalUrlHash,
    schemaVersion: "3.0.0",
    tier: "raw",
    canonicalUrlHash,
    contentHash: (r.contentHash as string) || canonicalUrlHash,
    version: typeof r.version === "number" ? r.version : 1,
    source: (r.source as TrainingSourceType) || "manual",
    pageType: (r.pageType as PageTypeLabel) || classifyPageType(canonicalUrl, rawInput),
    extractionConfidence:
      typeof r.extractionConfidence === "number"
        ? r.extractionConfidence
        : computeExtractionConfidence(rawInput),
    canonicalUrl,
    domain: (r.domain as string) || rawInput.domain || "unknown",
    brand: (r.brand as string) || "Independent",
    rawInput,
    targetOutput: (r.targetOutput || {}) as TargetOptimizedOutput,
    qualityScore: typeof r.qualityScore === "number" ? r.qualityScore : 75,
    scoreBreakdown: (r.scoreBreakdown || {
      completeness: 20,
      optimizationDelta: 20,
      geoEntityDepth: 15,
      schemaValidity: 20,
    }) as TrainingScoreBreakdown,
    status: (r.status as TrainingRecordStatus) || "pending",
    createdAt: (r.createdAt as string) || new Date().toISOString(),
    updatedAt: (r.updatedAt as string) || new Date().toISOString(),
  };
}

/**
 * Opens or initializes the IndexedDB store for the training vault with v3 schema.
 */
export async function openTrainingVaultDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = (event.currentTarget as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains("canonicalUrlHash")) {
        store.createIndex("canonicalUrlHash", "canonicalUrlHash", { unique: false });
      }
      if (!store.indexNames.contains("contentHash")) {
        store.createIndex("contentHash", "contentHash", { unique: false });
      }
      if (!store.indexNames.contains("domain")) {
        store.createIndex("domain", "domain", { unique: false });
      }
      if (!store.indexNames.contains("status")) {
        store.createIndex("status", "status", { unique: false });
      }
      if (!store.indexNames.contains("source")) {
        store.createIndex("source", "source", { unique: false });
      }
      if (!store.indexNames.contains("createdAt")) {
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves or updates a paired training sample.
 * Features contentHash versioning: dedupes identical content, increments version when content updates.
 */
export async function saveTrainingPair(params: {
  rawInput: RawWebInput;
  targetOutput: TargetOptimizedOutput;
  brand?: string;
  source?: TrainingSourceType;
  pageType?: PageTypeLabel;
  status?: TrainingRecordStatus;
}): Promise<TrainingPairRecord> {
  const canonicalUrl = params.rawInput.canonicalUrl || params.rawInput.url;
  const canonicalHash = await computeCanonicalHash(canonicalUrl);
  const contentString = `${params.rawInput.rawTitle}:::${params.rawInput.rawMetaDesc}:::${params.rawInput.rawH1.join("|")}:::${params.rawInput.rawBodyText}`;
  const contentHash = await computeContentHash(contentString);
  const now = new Date().toISOString();

  const { qualityScore, breakdown } = computeDatasetQualityScore(
    params.rawInput,
    params.targetOutput
  );

  const brand = params.brand || params.targetOutput.brandGuardrail || "Independent";
  const source = params.source || "manual";
  const pageType = params.pageType || classifyPageType(canonicalUrl, params.rawInput);
  const extractionConfidence = computeExtractionConfidence(params.rawInput);

  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(canonicalHash);

      getReq.onsuccess = () => {
        const rawExisting = getReq.result;
        const existing = rawExisting ? migrateRecordToV3(rawExisting) : undefined;
        const status = params.status || existing?.status || "pending";

        // Versioning logic: if content hash changed, increment version
        let version = 1;
        if (existing) {
          version = existing.contentHash === contentHash ? existing.version : existing.version + 1;
        }

        const record: TrainingPairRecord = {
          id: canonicalHash,
          schemaVersion: "3.0.0",
          tier: "raw",
          canonicalUrlHash: canonicalHash,
          contentHash,
          version,
          source,
          pageType,
          extractionConfidence,
          canonicalUrl,
          domain: params.rawInput.domain,
          brand,
          rawInput: params.rawInput,
          targetOutput: params.targetOutput,
          qualityScore,
          scoreBreakdown: breakdown,
          status,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };

        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(record);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  // In-memory fallback
  const rawExisting = inMemoryVault.get(canonicalHash);
  const existing = rawExisting ? migrateRecordToV3(rawExisting) : undefined;
  const status = params.status || existing?.status || "pending";
  let version = 1;
  if (existing) {
    version = existing.contentHash === contentHash ? existing.version : existing.version + 1;
  }

  const record: TrainingPairRecord = {
    id: canonicalHash,
    schemaVersion: "3.0.0",
    tier: "raw",
    canonicalUrlHash: canonicalHash,
    contentHash,
    version,
    source,
    pageType,
    extractionConfidence,
    canonicalUrl,
    domain: params.rawInput.domain,
    brand,
    rawInput: params.rawInput,
    targetOutput: params.targetOutput,
    qualityScore,
    scoreBreakdown: breakdown,
    status,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  inMemoryVault.set(canonicalHash, record);
  return record;
}

/**
 * Updates the target output of a training pair, recalculating quality score.
 */
export async function updateTrainingPairTarget(
  id: string,
  targetOutput: TargetOptimizedOutput,
  status?: TrainingRecordStatus
): Promise<TrainingPairRecord> {
  const existing = await getTrainingPairById(id);
  if (!existing) {
    throw new Error(`Training pair with ID ${id} not found.`);
  }

  return saveTrainingPair({
    rawInput: existing.rawInput,
    targetOutput,
    brand: targetOutput.brandGuardrail || existing.brand,
    source: existing.source,
    pageType: existing.pageType,
    status: status || existing.status,
  });
}

/**
 * Updates the approval status of a training pair (pending, approved, rejected).
 */
export async function updateTrainingPairStatus(
  id: string,
  status: TrainingRecordStatus
): Promise<TrainingPairRecord> {
  const existing = await getTrainingPairById(id);
  if (!existing) {
    throw new Error(`Training pair with ID ${id} not found.`);
  }

  const now = new Date().toISOString();
  const updatedRecord: TrainingPairRecord = {
    ...existing,
    status,
    updatedAt: now,
  };

  const db = await openTrainingVaultDb();
  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(updatedRecord);
      putReq.onsuccess = () => resolve(updatedRecord);
      putReq.onerror = () => reject(putReq.error);
    });
  }

  inMemoryVault.set(id, updatedRecord);
  return updatedRecord;
}

/**
 * Deletes a training pair by ID.
 */
export async function deleteTrainingPair(id: string): Promise<boolean> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  const existed = inMemoryVault.has(id);
  inMemoryVault.delete(id);
  return existed;
}

/**
 * Deletes all training records belonging to a specific domain.
 */
export async function deleteSamplesByDomain(domain: string): Promise<number> {
  const targetDomain = domain.toLowerCase().trim();
  const records = await getAllTrainingPairs();
  const toDelete = records.filter(
    (r) => r.domain.toLowerCase() === targetDomain || r.domain.toLowerCase().includes(targetDomain)
  );

  for (const item of toDelete) {
    await deleteTrainingPair(item.id);
  }

  return toDelete.length;
}

/**
 * Retrieves a training sample by primary ID (hash).
 */
export async function getTrainingPairById(id: string): Promise<TrainingPairRecord | null> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        if (!req.result) resolve(null);
        else resolve(migrateRecordToV3(req.result));
      };
      req.onerror = () => reject(req.error);
    });
  }

  const found = inMemoryVault.get(id);
  return found ? migrateRecordToV3(found) : null;
}

/**
 * Retrieves a training sample by canonical URL.
 */
export async function getTrainingPairByUrl(canonicalUrl: string): Promise<TrainingPairRecord | null> {
  const hash = await computeCanonicalHash(canonicalUrl);
  return getTrainingPairById(hash);
}

/**
 * Retrieves all training samples currently saved in the local vault with migration applied.
 */
export async function getAllTrainingPairs(): Promise<TrainingPairRecord[]> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as unknown[];
        const migrated = records.map(migrateRecordToV3);
        resolve(migrated);
      };
      req.onerror = () => reject(req.error);
    });
  }

  return Array.from(inMemoryVault.values()).map(migrateRecordToV3);
}

/**
 * Computes high-level statistics for the training vault.
 */
export async function getTrainingVaultStats(): Promise<TrainingVaultStats> {
  const records = await getAllTrainingPairs();
  const total = records.length;
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let totalScore = 0;

  for (const record of records) {
    if (record.status === "approved") approved++;
    else if (record.status === "rejected") rejected++;
    else pending++;

    totalScore += record.qualityScore;
  }

  return {
    total,
    approved,
    pending,
    rejected,
    avgQualityScore: total > 0 ? Math.round(totalScore / total) : 0,
  };
}

/**
 * Clears all training samples from the local vault.
 */
export async function clearTrainingVault(): Promise<void> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  inMemoryVault.clear();
}

/**
 * Exports all vault records formatted as line-delimited JSON (JSONL) for LLM fine-tuning.
 */
export async function exportVaultAsJsonl(): Promise<string> {
  const records = await getAllTrainingPairs();
  return records
    .map((record) =>
      JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are an expert hospitality SEO and GEO optimization assistant specializing in ${record.brand} franchise brand standards.`,
          },
          {
            role: "user",
            content: `Optimize the following hotel page:\nTitle: ${record.rawInput.rawTitle}\nMeta Description: ${record.rawInput.rawMetaDesc}\nH1: ${record.rawInput.rawH1.join(", ")}\nContent: ${record.rawInput.rawBodyText.slice(0, 500)}`,
          },
          {
            role: "assistant",
            content: JSON.stringify(record.targetOutput),
          },
        ],
        metadata: {
          canonicalUrl: record.canonicalUrl,
          qualityScore: record.qualityScore,
          brand: record.brand,
          status: record.status,
          source: record.source,
          pageType: record.pageType,
          extractionConfidence: record.extractionConfidence,
          contentHash: record.contentHash,
          version: record.version,
        },
      })
    )
    .join("\n");
}
