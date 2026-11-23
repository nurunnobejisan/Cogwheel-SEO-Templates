/**
 * Cogwheel SEO & GEO Studio - Supervised Fine-Tuning Dataset Builder & API Sync
 *
 * Formats curated DOM training pairs for LLM fine-tuning:
 * 1. Google Gemini Supervised Fine-Tuning (.jsonl) with systemInstruction and contents (user / model).
 * 2. OpenAI / Llama / Unsloth ChatML (.jsonl) with messages (system, user, assistant).
 * 3. Direct App API Sync: pushes approved training pairs via HTTP POST with Bearer token authorization.
 */

import {
  RawWebInput,
  TargetOptimizedOutput,
  TrainingPairRecord,
} from "../storage/training-vault";

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export interface GeminiSystemInstruction {
  parts: GeminiContentPart[];
}

export interface GeminiFineTuningRecord {
  systemInstruction: GeminiSystemInstruction;
  contents: GeminiContent[];
}

export interface ChatMlMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatMlRecord {
  messages: ChatMlMessage[];
  metadata?: {
    canonicalUrl: string;
    qualityScore: number;
    brand: string;
    id: string;
  };
}

export interface DatasetExportOptions {
  onlyApproved?: boolean;
  minQualityScore?: number;
  brandFilter?: string;
  includeMetadata?: boolean;
}

export interface ApiSyncConfig {
  endpointUrl: string;
  bearerToken: string;
  autoSyncOnApproval?: boolean;
}

export interface ApiSyncResult {
  success: boolean;
  status: number;
  message: string;
  timestamp: string;
  error?: string;
}

export interface BatchSyncSummary {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

/**
 * Standardized system instruction generator tailored by brand guardrails.
 */
export function formatSystemPrompt(brand: string): string {
  const brandName = (brand || "Independent").trim();
  return (
    `You are an expert hospitality SEO and Generative Engine Optimization (GEO) AI assistant specializing in ${brandName} franchise brand standards, SERP pixel budgeting, Schema.org Hotel graphs, and generative search visibility (ChatGPT, Google Gemini, Perplexity). Given an unoptimized hotel webpage DOM snapshot, output a valid JSON object matching the target optimization schema.`
  );
}

/**
 * Standardized user prompt formatting raw DOM inputs.
 */
export function formatUserPrompt(raw: RawWebInput): string {
  const parts: string[] = [
    `Optimize the following hotel webpage:`,
    `Domain: ${raw.domain || "Unknown"}`,
    `Canonical URL: ${raw.canonicalUrl || raw.url}`,
    `Current Title: ${raw.rawTitle || "(Missing)"}`,
    `Current Meta Description: ${raw.rawMetaDesc || "(Missing)"}`,
  ];

  if (raw.rawH1 && raw.rawH1.length > 0) {
    parts.push(`Current H1: ${raw.rawH1.join(" | ")}`);
  }
  if (raw.rawH2 && raw.rawH2.length > 0) {
    parts.push(`Current H2 Elements: ${raw.rawH2.slice(0, 5).join(" | ")}`);
  }
  if (raw.detectedSchemas && raw.detectedSchemas.length > 0) {
    parts.push(`Detected Schemas: ${raw.detectedSchemas.join(", ")}`);
  }
  if (raw.rawBodyText && raw.rawBodyText.trim().length > 0) {
    const truncatedBody = raw.rawBodyText.trim().slice(0, 600);
    parts.push(`Page Content Excerpt: ${truncatedBody}`);
  }

  return parts.join("\n");
}

/**
 * Formats model target output as a clean, deterministic JSON string.
 */
export function formatModelResponse(target: TargetOptimizedOutput): string {
  return JSON.stringify(
    {
      optimizedTitle: target.optimizedTitle,
      optimizedMetaDesc: target.optimizedMetaDesc,
      optimizedH1: target.optimizedH1,
      jsonLdSchema: target.jsonLdSchema,
      geoEntityBlock: target.geoEntityBlock,
      brandGuardrail: target.brandGuardrail,
    },
    null,
    2
  );
}

/**
 * Converts a training record to Google Gemini Fine-Tuning schema.
 */
export function recordToGemini(record: TrainingPairRecord): GeminiFineTuningRecord {
  return {
    systemInstruction: {
      parts: [
        {
          text: formatSystemPrompt(record.brand),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: formatUserPrompt(record.rawInput),
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: formatModelResponse(record.targetOutput),
          },
        ],
      },
    ],
  };
}

/**
 * Converts a training record to OpenAI / Llama / Unsloth ChatML schema.
 */
export function recordToChatMl(
  record: TrainingPairRecord,
  includeMetadata = true
): ChatMlRecord {
  const result: ChatMlRecord = {
    messages: [
      {
        role: "system",
        content: formatSystemPrompt(record.brand),
      },
      {
        role: "user",
        content: formatUserPrompt(record.rawInput),
      },
      {
        role: "assistant",
        content: formatModelResponse(record.targetOutput),
      },
    ],
  };

  if (includeMetadata) {
    result.metadata = {
      canonicalUrl: record.canonicalUrl,
      qualityScore: record.qualityScore,
      brand: record.brand,
      id: record.id,
    };
  }

  return result;
}

/**
 * Filters training records according to specified export options.
 */
export function filterRecords(
  records: TrainingPairRecord[],
  options?: DatasetExportOptions
): TrainingPairRecord[] {
  if (!options) return records;

  return records.filter((rec) => {
    if (options.onlyApproved && rec.status !== "approved") {
      return false;
    }
    if (
      typeof options.minQualityScore === "number" &&
      rec.qualityScore < options.minQualityScore
    ) {
      return false;
    }
    if (
      options.brandFilter &&
      options.brandFilter !== "All" &&
      rec.brand.toLowerCase() !== options.brandFilter.toLowerCase()
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Builds Google Gemini Supervised Fine-Tuning JSONL string.
 */
export function buildGeminiJsonl(
  records: TrainingPairRecord[],
  options?: DatasetExportOptions
): string {
  const filtered = filterRecords(records, options);
  return filtered
    .map((record) => JSON.stringify(recordToGemini(record)))
    .join("\n");
}

/**
 * Builds OpenAI / Llama / Unsloth ChatML JSONL string.
 */
export function buildChatMlJsonl(
  records: TrainingPairRecord[],
  options?: DatasetExportOptions
): string {
  const filtered = filterRecords(records, options);
  const includeMeta = options?.includeMetadata ?? false;
  return filtered
    .map((record) => JSON.stringify(recordToChatMl(record, includeMeta)))
    .join("\n");
}

/**
 * Estimates token count using standard ~4 characters per token heuristic.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Direct App API Sync: Pushes an approved training pair to an external REST / Webhook endpoint.
 */
export async function syncRecordToApi(
  record: TrainingPairRecord,
  config: ApiSyncConfig,
  fetchFn: typeof fetch = fetch
): Promise<ApiSyncResult> {
  const now = new Date().toISOString();
  const endpoint = (config.endpointUrl || "").trim();

  if (!endpoint) {
    return {
      success: false,
      status: 400,
      message: "Webhook endpoint URL is not configured.",
      timestamp: now,
      error: "Missing endpointUrl",
    };
  }

  const payload = {
    event: "training_pair_sync",
    timestamp: now,
    record: {
      id: record.id,
      canonicalUrl: record.canonicalUrl,
      domain: record.domain,
      brand: record.brand,
      status: record.status,
      qualityScore: record.qualityScore,
      scoreBreakdown: record.scoreBreakdown,
      rawInput: record.rawInput,
      targetOutput: record.targetOutput,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    exportFormats: {
      gemini: recordToGemini(record),
      chatMl: recordToChatMl(record, true),
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.bearerToken && config.bearerToken.trim().length > 0) {
    headers["Authorization"] = `Bearer ${config.bearerToken.trim()}`;
  }

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return {
        success: true,
        status: res.status,
        message: `Successfully synced record ${record.id} to backend API (HTTP ${res.status}).`,
        timestamp: now,
      };
    } else {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        status: res.status,
        message: `Failed to sync record (HTTP ${res.status}): ${errText.slice(0, 200)}`,
        timestamp: now,
        error: errText,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 0,
      message: `Network error connecting to API: ${message}`,
      timestamp: now,
      error: message,
    };
  }
}

/**
 * Direct App API Sync: Batch pushes multiple training records to the backend endpoint.
 */
export async function syncBatchToApi(
  records: TrainingPairRecord[],
  config: ApiSyncConfig,
  fetchFn: typeof fetch = fetch
): Promise<BatchSyncSummary> {
  const summary: BatchSyncSummary = {
    total: records.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    const res = await syncRecordToApi(record, config, fetchFn);
    if (res.success) {
      summary.successful++;
    } else {
      summary.failed++;
      if (res.error) {
        summary.errors.push(`${record.canonicalUrl}: ${res.error}`);
      }
    }
  }

  return summary;
}
