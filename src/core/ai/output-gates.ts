/**
 * Runtime Output Validation Gates for the v1 Fine-Tuned Adapter (WP3).
 *
 * Enforces deterministic schema and SERP budget constraints on model output
 * before accepting completions from `seo-studio-tuned`. Reads the canonical
 * schema type list from `schemas/known-schema-types.json` (shared with
 * `ml/eval/run_eval.py`) and delegates SERP measurements to
 * `validators/serpOptimizer.ts`.
 */

import knownSchemaTypesJson from "../../../schemas/known-schema-types.json";
import { analyzeSerpSnippet } from "../../../validators/serpOptimizer";
import type { TaskKind } from "../../../ai/types";

export const KNOWN_SCHEMA_TYPES: ReadonlySet<string> = new Set(knownSchemaTypesJson);

export interface GateInputContext {
  prompt: string;
  system?: string;
  brand?: string;
}

export interface GateResult {
  ok: boolean;
  failures: string[];
}

const PHONE_KEY_RE = /^(?:telephone|phone|faxnumber)$/i;
const ADDRESS_KEY_RE = /^(?:streetaddress|postalcode|addresslocality|addressregion)$/i;
const PRICE_KEY_RE = /^(?:price|pricerange|lowprice|highprice|minprice|maxprice)$/i;

const PHONE_VALUE_RE = /\+?\d[\d\s().-]{6,}\d/g;
const PRICE_VALUE_RE = /(?:\$|€|£)\s*\d[\d,.]*|\b\d[\d,.]*\s*(?:USD|EUR|GBP)\b|\${2,}/gi;

const METRIC_PATTERNS: ReadonlyArray<{ code: string; regex: RegExp }> = [
  { code: "invented_metrics:ranking", regex: /\brank(?:ing)?s?\s*(?:of|#|:)?\s*\d{1,3}\b/i },
  { code: "invented_metrics:position", regex: /\bposition\s*[:#]?\s*\d{1,3}\b/i },
  { code: "invented_metrics:search_volume", regex: /\bsearch(?:es)?\s+volume\b|\b\d[\d,]*\s+searches\b/i },
  { code: "invented_metrics:cpc", regex: /\bCPC\b|\bcost[- ]per[- ]click\b/i },
  { code: "invented_metrics:traffic", regex: /\btraffic\b[^.\n]{0,24}\b\d[\d,.]*k?\b/i },
  { code: "invented_metrics:visits", regex: /\b\d[\d,.]*k?\s+(?:monthly\s+)?(?:visits|visitors|sessions|clicks)\b/i },
  { code: "invented_metrics:citations", regex: /\b\d+\s+(?:AI\s+)?citations?\b/i },
  { code: "invented_metrics:domain_rating", regex: /\b(?:domain rating|DR)\s*[:#]?\s*\d{1,3}\b/i },
];

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const cleaned = stripMarkdownFences(raw);
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}");
    const arrStart = cleaned.indexOf("[");
    const arrEnd = cleaned.lastIndexOf("]");
    const candidates: string[] = [];
    if (arrStart !== -1 && arrEnd > arrStart && (objStart === -1 || arrStart < objStart)) {
      candidates.push(cleaned.slice(arrStart, arrEnd + 1));
    }
    if (objStart !== -1 && objEnd > objStart) {
      candidates.push(cleaned.slice(objStart, objEnd + 1));
    }
    for (const slice of candidates) {
      try {
        return { ok: true, value: JSON.parse(slice) };
      } catch {
        // try next
      }
    }
    return { ok: false };
  }
}

function collectTypedNodes(parsed: unknown): Array<Record<string, unknown>> {
  const roots = Array.isArray(parsed) ? parsed : [parsed];
  const nodes: Array<Record<string, unknown>> = [];

  for (const root of roots) {
    if (!root || typeof root !== "object" || Array.isArray(root)) continue;
    const obj = root as Record<string, unknown>;
    const candidate =
      obj.jsonLd && typeof obj.jsonLd === "object" && !Array.isArray(obj.jsonLd)
        ? (obj.jsonLd as Record<string, unknown>)
        : obj;

    if (Array.isArray(candidate["@graph"])) {
      for (const graphNode of candidate["@graph"]) {
        if (graphNode && typeof graphNode === "object" && !Array.isArray(graphNode)) {
          nodes.push(graphNode as Record<string, unknown>);
        }
      }
    } else {
      nodes.push(candidate);
    }
  }

  return nodes;
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

function walkObjectLeaves(
  value: unknown,
  parentKey: string,
  visit: (key: string, leaf: string | number) => void,
): void {
  if (typeof value === "string" || typeof value === "number") {
    visit(parentKey, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkObjectLeaves(item, parentKey, visit);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkObjectLeaves(child, key, visit);
    }
  }
}

function checkTokenGrounded(val: string, inputLower: string): boolean {
  const normalized = val.trim().toLowerCase();
  if (!normalized) return true;
  if (inputLower.includes(normalized)) return true;
  const tokens = normalized.match(/[a-z0-9]{3,}|\d+/g) ?? [];
  return tokens.length === 0 || tokens.every((tok) => inputLower.includes(tok));
}

function gateSchemaGeneration(text: string, promptInput: string): GateResult {
  const failures: string[] = [];
  const parsed = tryParseJson(text);
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== "object") {
    return { ok: false, failures: ["invalid_json"] };
  }
  if (Array.isArray(parsed.value) && parsed.value.length === 0) {
    return { ok: false, failures: ["empty_schema_array"] };
  }

  const nodes = collectTypedNodes(parsed.value);
  if (nodes.length === 0) {
    return { ok: false, failures: ["missing_schema_object"] };
  }

  let hasAnyType = false;
  for (const node of nodes) {
    const rawType = node["@type"];
    const types =
      typeof rawType === "string"
        ? [rawType]
        : Array.isArray(rawType)
          ? rawType.filter((item): item is string => typeof item === "string")
          : [];

    if (types.length === 0) {
      failures.push("missing_schema_type");
      continue;
    }
    hasAnyType = true;
    for (const schemaType of types) {
      if (!KNOWN_SCHEMA_TYPES.has(schemaType)) {
        failures.push(`unknown_schema_type:${schemaType}`);
      }
    }
  }
  if (!hasAnyType && !failures.includes("missing_schema_type")) {
    failures.push("missing_schema_type");
  }

  const inputLower = promptInput.toLowerCase();
  const inputDigits = digitsOnly(promptInput);
  const inputMeasured = /\bmeasured\b/.test(inputLower);

  walkObjectLeaves(parsed.value, "", (key, leaf) => {
    const strVal = String(leaf).trim();
    if (!strVal) return;

    if (PHONE_KEY_RE.test(key)) {
      const digits = digitsOnly(strVal);
      if (digits.length >= 7 && !inputDigits.includes(digits)) {
        failures.push("invented_phone");
      }
    } else {
      const phoneMatches = strVal.match(PHONE_VALUE_RE) ?? [];
      for (const m of phoneMatches) {
        const digits = digitsOnly(m);
        if (digits.length >= 7 && !inputDigits.includes(digits)) {
          failures.push("invented_phone");
          break;
        }
      }
    }

    if (ADDRESS_KEY_RE.test(key)) {
      if (!checkTokenGrounded(strVal, inputLower)) {
        failures.push(`invented_address:${key}`);
      }
    }

    if (PRICE_KEY_RE.test(key)) {
      if (!checkTokenGrounded(strVal, inputLower) && !inputLower.includes(strVal.toLowerCase())) {
        failures.push("invented_price");
      }
    } else if (PRICE_VALUE_RE.test(strVal)) {
      PRICE_VALUE_RE.lastIndex = 0;
      const matches = strVal.match(PRICE_VALUE_RE) ?? [];
      for (const m of matches) {
        const cleanedMatch = m.trim().toLowerCase();
        const digits = digitsOnly(m);
        if (!inputLower.includes(cleanedMatch) && (!digits || !inputDigits.includes(digits))) {
          failures.push("invented_price");
          break;
        }
      }
    }

    if (!inputMeasured && typeof leaf === "string") {
      for (const pat of METRIC_PATTERNS) {
        if (pat.regex.test(leaf)) {
          failures.push(pat.code);
        }
      }
    }
  });

  const unique = [...new Set(failures)];
  return { ok: unique.length === 0, failures: unique };
}

function cleanDiffMarkers(value: string): string {
  return value.replace(/~~[\s\S]*?~~/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

interface ExtractedMetadataSnippet {
  title?: string;
  description?: string;
}

function extractMetadataSnippets(text: string): {
  snippets: ExtractedMetadataSnippet[];
  combinedText: string;
} {
  const parsed = tryParseJson(text);
  if (parsed.ok && parsed.value && typeof parsed.value === "object") {
    const obj = parsed.value as Record<string, unknown>;
    if (Array.isArray(obj.rows)) {
      const snippets: ExtractedMetadataSnippet[] = [];
      for (const row of obj.rows) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const rawTitle = r.proposedTitle ?? r.title ?? r.optimizedTitle;
        const rawDesc = r.proposedMeta ?? r.metaDescription ?? r.description ?? r.optimizedMetaDesc;
        if (typeof rawTitle === "string" || typeof rawDesc === "string") {
          snippets.push({
            title: typeof rawTitle === "string" ? cleanDiffMarkers(rawTitle) : undefined,
            description: typeof rawDesc === "string" ? cleanDiffMarkers(rawDesc) : undefined,
          });
        }
      }
      if (snippets.length > 0) {
        const combinedText = snippets
          .map((s) => `${s.title ?? ""} ${s.description ?? ""}`.trim())
          .join(" ");
        return { snippets, combinedText };
      }
    }

    const rawTitle = obj.title ?? obj.proposedTitle ?? obj.optimizedTitle;
    const rawDesc = obj.metaDescription ?? obj.description ?? obj.proposedMeta ?? obj.optimizedMetaDesc;
    if (typeof rawTitle === "string" || typeof rawDesc === "string") {
      const title = typeof rawTitle === "string" ? cleanDiffMarkers(rawTitle) : undefined;
      const description = typeof rawDesc === "string" ? cleanDiffMarkers(rawDesc) : undefined;
      return {
        snippets: [{ title, description }],
        combinedText: `${title ?? ""} ${description ?? ""}`.trim(),
      };
    }
  }

  const titleMatch = text.match(/^(?:title|meta\s*title)\s*:\s*(.+)$/im);
  const descMatch = text.match(/^(?:description|meta\s*description)\s*:\s*(.+)$/im);
  if (titleMatch || descMatch) {
    const title = titleMatch ? cleanDiffMarkers(titleMatch[1] ?? "") : undefined;
    const description = descMatch ? cleanDiffMarkers(descMatch[1] ?? "") : undefined;
    return {
      snippets: [{ title, description }],
      combinedText: `${title ?? ""} ${description ?? ""}`.trim(),
    };
  }

  return { snippets: [], combinedText: text.trim() };
}

function inferBrand(input: GateInputContext): string {
  if (input.brand && input.brand.trim()) return input.brand.trim();
  const prompt = input.prompt;
  const jsonBrandMatch = prompt.match(/"brand"\s*:\s*"([^"]+)"/i);
  if (jsonBrandMatch?.[1]?.trim()) return jsonBrandMatch[1].trim();
  const lineBrandMatch = prompt.match(/(?:^|\n)[-\s]*brand\s*:\s*([^\n(]+)/i);
  if (lineBrandMatch?.[1]?.trim()) return lineBrandMatch[1].trim();
  return "";
}

function matchesBrand(combinedText: string, brand: string): boolean {
  const hay = combinedText.toLowerCase();
  const cleanBrand = brand.trim().toLowerCase();
  if (!cleanBrand) return true;
  if (hay.includes(cleanBrand)) return true;
  const parts = cleanBrand
    .split(/[/|]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  return parts.some((part) => hay.includes(part));
}

function gateMetadataGeneration(text: string, ctx: GateInputContext): GateResult {
  const failures: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, failures: ["empty_output"] };
  }

  const { snippets, combinedText } = extractMetadataSnippets(trimmed);
  if (snippets.length === 0) {
    // Allow non-SERP structured drafts (e.g. heading rows) only when valid JSON has rows,
    // otherwise reject unstructured text missing title/description metadata.
    const parsed = tryParseJson(trimmed);
    const hasRows =
      parsed.ok &&
      parsed.value &&
      typeof parsed.value === "object" &&
      Array.isArray((parsed.value as { rows?: unknown[] }).rows) &&
      (parsed.value as { rows: unknown[] }).rows.length > 0;
    if (!hasRows) {
      failures.push("missing_metadata_fields");
    }
  } else {
    for (const snippet of snippets) {
      const title = snippet.title ?? "";
      const description = snippet.description ?? "";
      const serp = analyzeSerpSnippet(title, description);
      if (snippet.title !== undefined && !title) {
        failures.push("missing_title");
      }
      if (title && (serp.title.desktopOverflow || title.length > 60)) {
        failures.push("title_budget_exceeded");
      }
      if (snippet.description !== undefined && !description) {
        failures.push("missing_meta_description");
      }
      if (description && (serp.metaDescription.pixelOverflow || serp.metaDescription.isTooLong)) {
        failures.push("description_budget_exceeded");
      }
    }
  }

  const brand = inferBrand(ctx);
  if (brand && !matchesBrand(combinedText, brand)) {
    failures.push("missing_brand");
  }

  const unique = [...new Set(failures)];
  return { ok: unique.length === 0, failures: unique };
}

/**
 * Validate a v1 model output deterministically against task-specific safety
 * and budget gates before serving it to users.
 */
export function gateOutput(
  task: TaskKind,
  text: string,
  input: string | GateInputContext,
): GateResult {
  const ctx: GateInputContext =
    typeof input === "string" ? { prompt: input } : input;

  if (task === "schema_generation") {
    return gateSchemaGeneration(text, ctx.prompt);
  }
  if (task === "metadata_generation") {
    return gateMetadataGeneration(text, ctx);
  }
  return { ok: true, failures: [] };
}
