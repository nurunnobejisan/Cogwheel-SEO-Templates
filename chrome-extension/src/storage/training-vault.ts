/**
 * Cogwheel SEO & GEO Studio - Training Data Vault (IndexedDB Store)
 *
 * Implements a persistent, client-side dataset repository for fine-tuning
 * and Generative Engine Optimization. Automatically pairs raw webpage DOM snapshots
 * with optimized targets (Title, Meta Description, JSON-LD, and GEO entity blocks),
 * computes dataset quality scores (0-100), and deduplicates by canonical URL hash.
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

export interface TrainingPairRecord {
  id: string; // Unique primary key derived from canonical URL hash
  canonicalUrlHash: string;
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
export const DB_VERSION = 2;
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

  // Use Web Crypto API when available in browser / modern runtime
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(normalized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    } catch {
      // Fallback to deterministic string hashing if crypto.subtle fails
    }
  }

  // Deterministic FNV-1a 32-bit hash fallback
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "hash_" + (hash >>> 0).toString(16).padStart(8, "0");
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

  const total = completeness + optimizationDelta + geoEntityDepth + schemaValidity;
  const qualityScore = Math.min(100, Math.max(0, total));

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

// In-memory fallback repository when running in environments without IndexedDB (e.g., Node tests)
const inMemoryVault = new Map<string, TrainingPairRecord>();

/**
 * Initializes and returns the IndexedDB database instance.
 */
export function openTrainingVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains("canonicalUrlHash")) {
        store.createIndex("canonicalUrlHash", "canonicalUrlHash", { unique: true });
      }
      if (!store.indexNames.contains("brand")) {
        store.createIndex("brand", "brand", { unique: false });
      }
      if (!store.indexNames.contains("qualityScore")) {
        store.createIndex("qualityScore", "qualityScore", { unique: false });
      }
      if (!store.indexNames.contains("status")) {
        store.createIndex("status", "status", { unique: false });
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
 * Saves or updates a paired training sample. Deduplicates by canonical URL hash.
 */
export async function saveTrainingPair(params: {
  rawInput: RawWebInput;
  targetOutput: TargetOptimizedOutput;
  brand?: string;
  status?: TrainingRecordStatus;
}): Promise<TrainingPairRecord> {
  const canonicalUrl = params.rawInput.canonicalUrl || params.rawInput.url;
  const hash = await computeCanonicalHash(canonicalUrl);
  const now = new Date().toISOString();

  const { qualityScore, breakdown } = computeDatasetQualityScore(
    params.rawInput,
    params.targetOutput
  );

  const brand = params.brand || params.targetOutput.brandGuardrail || "Independent";

  const db = await openTrainingVaultDb();

  // If in IndexedDB environment
  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const getReq = store.get(hash);

      getReq.onsuccess = () => {
        const existing = getReq.result as TrainingPairRecord | undefined;
        const status = params.status || existing?.status || "pending";

        const record: TrainingPairRecord = {
          id: hash,
          canonicalUrlHash: hash,
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
  const existing = inMemoryVault.get(hash);
  const status = params.status || existing?.status || "pending";
  const record: TrainingPairRecord = {
    id: hash,
    canonicalUrlHash: hash,
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

  inMemoryVault.set(hash, record);
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
 * Retrieves a training sample by primary ID (hash).
 */
export async function getTrainingPairById(id: string): Promise<TrainingPairRecord | null> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as TrainingPairRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  return inMemoryVault.get(id) || null;
}

/**
 * Retrieves a training sample by canonical URL.
 */
export async function getTrainingPairByUrl(canonicalUrl: string): Promise<TrainingPairRecord | null> {
  const hash = await computeCanonicalHash(canonicalUrl);
  return getTrainingPairById(hash);
}

/**
 * Retrieves all training samples currently saved in the local vault.
 */
export async function getAllTrainingPairs(): Promise<TrainingPairRecord[]> {
  const db = await openTrainingVaultDb();

  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as TrainingPairRecord[]) || [];
        const normalized = records.map((r) => ({
          ...r,
          status: r.status || "pending",
        }));
        resolve(normalized);
      };
      req.onerror = () => reject(req.error);
    });
  }

  return Array.from(inMemoryVault.values()).map((r) => ({
    ...r,
    status: r.status || "pending",
  }));
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
        },
      })
    )
    .join("\n");
}
