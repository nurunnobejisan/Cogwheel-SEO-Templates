import "server-only";

import { runFullWebsiteAudit, type FullWebsiteAuditReport } from "@/core/full-audit";
import {
  fullAuditTool,
  schemaCheckTool,
  keywordResearchTool,
  searchConsoleTool,
  serpDataTool,
  llmsCheckTool,
  citabilityTool,
  driftTool,
  visibilityTrackerTool,
  gapDetectorTool,
  type ToolResult,
} from "./tools";
import { latestVisibilityRun } from "@/core/visibility/store";
import { loadRepoCorpus } from "./corpus";
import { canUseLlm, recordLlmUsage } from "./usage";
import { createRagPipeline, type RagPipeline } from "../../../ai/rag";
import { generateClaudeText, isClaudeConfigured } from "@/core/claude";

export const BRAIN_SYSTEM_PROMPT = `You are the SEO Brain.

You interpret a MEASURED audit produced by the SEO Studio audit engine. The audit
report contains only facts measured from the live page, plus sections explicitly
labelled "estimated" or "unavailable".

HARD CONSTRAINTS (non-negotiable):
1. Never invent rankings, search volumes, AI citations, competitor names, fees,
   revenue figures, or benchmark scores.
2. If a dimension is unavailable or unmeasured, say so plainly; do not fill gaps
   with plausible-sounding numbers.
3. Every factual claim must map to a measured field in the audit/tool data or to
   a retrieved knowledge-base chunk. Cite the chunk id in brackets when you rely
   on it, e.g. [kc-title-tag]. Unmapped claims are rejected by a deterministic
   gate and replaced with the measured summary.
4. Prefer "not measured" over guessing. "Measure, label, or leave blank."
5. Distinguish "measured", "estimated", and "unavailable" exactly as the tool
   results do. Never describe an unavailable surface as if it were measured.
6. Output structured JSON only when asked for JSON; otherwise concise markdown.`;

export interface BrainRequest {
  targetUrl: string;
  question?: string;
  maxPages?: number;
}

/** Thrown when even the deterministic fallback cannot trace a claim. */
export class BrainProvenanceError extends Error {
  constructor(public readonly check: ClaimProvenanceResult) {
    super("Brain output failed claim-to-field provenance after deterministic fallback.");
    this.name = "BrainProvenanceError";
  }
}

export interface BrainResult {
  targetUrl: string;
  audit: Awaited<ReturnType<typeof runFullWebsiteAudit>>;
  retrieved: Array<{ id: string; title: string; source: string; score: number }>;
  interpretation: string;
  provider: string;
  generatedAt: string;
  tools: Array<{ name: string; available: boolean; provenance: string; reason?: string }>;
  provenanceCheck: ClaimProvenanceResult;
}

let cachedPipeline: RagPipeline | null = null;
export async function getPipeline(): Promise<RagPipeline> {
  if (cachedPipeline) return cachedPipeline;
  let extra: Awaited<ReturnType<typeof loadRepoCorpus>> = [];
  try {
    extra = await loadRepoCorpus();
  } catch {
    extra = [];
  }
  cachedPipeline = createRagPipeline({ extraChunks: extra });
  return cachedPipeline;
}

export async function runBrain(request: BrainRequest): Promise<BrainResult> {
  const targetUrl = request.targetUrl.trim();
  const auditResult = await fullAuditTool(targetUrl, request.maxPages ?? 10);
  const audit = auditResult.data!;
  const schemaResult = schemaCheckTool(audit);
  const keywordResult = keywordResearchTool(new URL(targetUrl).hostname);
  const gscResult = searchConsoleTool(audit);
  const serpResult = serpDataTool(audit);
  const latestVisibility = await latestVisibilityRun(targetUrl).catch(() => null);
  const toolResults = [
    auditResult,
    schemaResult,
    keywordResult,
    gscResult,
    serpResult,
    llmsCheckTool(audit),
    citabilityTool(audit),
    driftTool(audit),
    await visibilityTrackerTool(targetUrl),
    gapDetectorTool(latestVisibility),
  ];

  const pipeline = await getPipeline();
  const query =
    request.question?.trim() ||
    `SEO audit findings for ${targetUrl}: ${audit.actionPlan?.map((i) => i.title).join(" ") ?? ""}`;
  const retrieved = pipeline.knowledgeBase.search(query, { topK: 6 });

  const compactAudit = {
    targetUrl: audit.targetUrl,
    domain: audit.domain,
    overallScore: audit.overallScore,
    scores: audit.scores,
    provenance: audit.dataProvenance,
    geo: audit.geoAudit
      ? {
          llmsTxt: {
            status: audit.geoAudit.llmsTxt.status,
            score: audit.geoAudit.llmsTxt.score,
            failedChecks: audit.geoAudit.llmsTxt.checks.filter((check) => !check.pass).map((check) => check.label),
          },
          aiCrawlers: {
            status: audit.geoAudit.aiCrawlers.status,
            blockedBots: audit.geoAudit.aiCrawlers.blockedBots,
            unmentionedBots: audit.geoAudit.aiCrawlers.unmentionedBots,
          },
          citability: {
            score: audit.geoAudit.citability.score,
            formula: audit.geoAudit.citability.formula,
            components: audit.geoAudit.citability.components.map((component) => ({
              id: component.id,
              score: component.score,
              weight: component.weight,
            })),
          },
          drift: {
            status: audit.geoAudit.drift.status,
            scoreDelta: audit.geoAudit.drift.scoreDelta,
            regressions: audit.geoAudit.drift.regressions,
          },
        }
      : null,
    topActions: (audit.actionPlan ?? []).slice(0, 15).map((a) => ({ priority: a.priority, title: a.title, category: a.category })),
    tools: toolResults.map((t) => ({ name: t.name, available: t.available, reason: t.reason, provenance: t.provenance })),
  };
  const auditJson = JSON.stringify(compactAudit, null, 2);
  const contextText = retrieved
    .map((c) => `[${c.id}] ${c.title} (${c.source}, score ${c.score})\n${c.text}`)
    .join("\n\n");

  const toolJson = JSON.stringify(
    toolResults.map((t) => ({
      name: t.name,
      available: t.available,
      provenance: t.provenance,
      reason: t.reason,
      // The full audit is already represented by compactAudit; avoid duplicating it.
      data: t.name === "full_audit" ? null : t.available ? t.data : null,
    })),
    null,
    2
  ).slice(0, 14_000);
  const prompt = `TOOLS (unconnected tools return "unavailable" — do not fabricate):\n${toolJson}\n\nAUDIT REPORT (measured facts only):\n${auditJson}\n\nRETRIEVED KNOWLEDGE:\n${contextText}\n\nUSER QUESTION:\n${request.question?.trim() || "Summarise the top issues and the safest next actions."}\n\nRespond with a concise, grounded summary. Mark any unavailable dimension explicitly. Cite source doc/rule ids in brackets.`;

  let interpretation: string;
  let provider: string;
  if (isClaudeConfigured()) {
    const cap = await canUseLlm();
    if (!cap.allowed) {
      interpretation = deterministicInterpretation(audit, retrieved);
      provider = `deterministic (cost cap: ${cap.reason})`;
    } else {
      try {
        interpretation = await generateClaudeText({
          system: BRAIN_SYSTEM_PROMPT,
          prompt,
          maxTokens: 1200,
          taskId: "brain-interpret",
        });
        await recordLlmUsage();
        provider = "llm";
      } catch (err) {
        interpretation = deterministicInterpretation(audit, retrieved);
        provider = `fallback (${(err as Error).message})`;
      }
    }
  } else {
    interpretation = deterministicInterpretation(audit, retrieved);
    provider = "deterministic";
  }

  let provenance = verifyClaimProvenance(interpretation, audit, retrieved);
  if (!provenance.ok && provider === "llm") {
    interpretation = deterministicInterpretation(audit, retrieved);
    provider = "deterministic (claim provenance gate)";
    provenance = verifyClaimProvenance(interpretation, audit, retrieved);
  }
  if (!provenance.ok) {
    // Last resort: emit only measured headline facts, then fail if still untraced.
    interpretation = `Measured overall score: ${audit.overallScore}/100.`;
    provenance = verifyClaimProvenance(interpretation, audit, retrieved);
  }
  if (!provenance.ok) {
    throw new BrainProvenanceError(provenance);
  }

  return {
    targetUrl,
    audit,
    retrieved: retrieved.map((c: { id: string; title: string; source: string; score: number }) => ({ id: c.id, title: c.title, source: c.source, score: c.score })),
    interpretation,
    provider,
    generatedAt: new Date().toISOString(),
    tools: toolResults.map((t) => ({ name: t.name, available: t.available, provenance: t.provenance, reason: t.reason })),
    provenanceCheck: provenance,
  };
}

function deterministicInterpretation(audit: Awaited<ReturnType<typeof runFullWebsiteAudit>>, retrieved: ReturnType<RagPipeline["knowledgeBase"]["search"]>): string {
  const plan = audit.actionPlan ?? [];
  const lines: string[] = [];
  lines.push(`# Measured audit summary for ${audit.targetUrl ?? audit.domain}`);
  lines.push("");
  lines.push(`- Overall score: ${audit.overallScore}/100`);
  lines.push(`- Action items: ${plan.length}`);
  if (audit.geoAudit) {
    const geo = audit.geoAudit;
    lines.push(
      `- llms.txt: ${geo.llmsTxt.status}${geo.llmsTxt.score !== null ? ` (${geo.llmsTxt.score}/100)` : ""}`
    );
    lines.push(
      `- AI crawler access: ${geo.aiCrawlers.status}; blocked: ${geo.aiCrawlers.blockedBots.length > 0 ? geo.aiCrawlers.blockedBots.join(", ") : "none"}`
    );
    lines.push(`- Citability: ${geo.citability.score}/100 (estimated; ${geo.citability.formula})`);
    lines.push(
      `- Drift: ${geo.drift.status}${geo.drift.scoreDelta !== null ? ` (${geo.drift.scoreDelta >= 0 ? "+" : ""}${geo.drift.scoreDelta} points)` : ""}`
    );
  }
  for (const item of plan.slice(0, 12)) {
    lines.push(`- [${item.priority}] ${item.title} (${item.category})`);
  }
  if (plan.length > 12) lines.push(`- …and ${plan.length - 12} more.`);
  lines.push("");
  lines.push("## Grounding");
  lines.push(retrieved.length
    ? retrieved.map((c) => `- [${c.id}] ${c.title}`).join("\n")
    : "- No knowledge-base chunks matched; recommendations limited to measured findings.");
  lines.push("");
  lines.push("Dimensions not measured are reported as unavailable rather than estimated.");
  return lines.join("\n");
}

export interface ProvenanceResult {
  ok: boolean;
  untracedNumbers: string[];
}

export function verifyProvenance(
  text: string,
  audit: FullWebsiteAuditReport,
  retrieved: Array<{ text?: string; title?: string }>,
): ProvenanceResult {
  const haystack =
    JSON.stringify(audit) +
    " " +
    String(audit.actionPlan?.length ?? 0) +
    " 100 0 " +
    retrieved.map((c) => `${c.title ?? ""} ${c.text ?? ""}`).join(" ");
  const numbers = Array.from(new Set(text.match(/\b\d+(?:\.\d+)?\b/g) ?? []));
  const untraced = numbers.filter((n) => !haystack.includes(n));
  return { ok: untraced.length === 0, untracedNumbers: untraced };
}

export interface ClaimProvenanceResult {
  ok: boolean;
  /** Numbers that do not appear in the audit or a retrieved chunk. */
  untracedNumbers: string[];
  /** Sentences whose content cannot be traced to the audit or a retrieved chunk. */
  unmappedClaims: string[];
  checkedClaims: number;
}

const CLAIM_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "will",
  "have", "has", "had", "not", "but", "can", "could", "should", "would", "may", "might", "must",
  "into", "than", "then", "them", "they", "their", "there", "here", "what", "when", "where", "which",
  "who", "why", "how", "all", "any", "each", "more", "most", "other", "some", "such", "only", "also",
  "about", "above", "after", "before", "between", "under", "over", "very", "just", "using", "use",
  "page", "site", "audit", "measured", "measure", "data", "result", "results", "report", "search",
]);

const META_CLAIM =
  /(not measured|unavailable|no knowledge-base|measure, label|presence only|does not verify|reported as unavailable|dimensions not measured)/i;

function claimSentences(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n+/)
    .flatMap((line) => line.replace(/^\s*(?:[#>*+-]|\d+[.)])\s*/, "").trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12 && /[a-z]/i.test(sentence));
}

function claimWords(sentence: string): string[] {
  return [...new Set(
    sentence
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !/^\d+$/.test(word) && !CLAIM_STOPWORDS.has(word))
  )];
}

function stem(word: string): string {
  return word.replace(/(?:ing|ed|es|s)$/, "");
}

/**
 * Claim-to-field provenance.
 *
 * Every sentence in the interpretation must either cite a retrieved chunk id,
 * or share enough content words with the measured audit/retrieved corpus to be
 * traceable. Numbers must appear verbatim in that source material. Sentences
 * that explicitly declare a dimension unavailable are allowed: they are honesty
 * statements, not unsupported claims.
 */
export function verifyClaimProvenance(
  text: string,
  audit: FullWebsiteAuditReport,
  retrieved: Array<{ id?: string; title?: string; text?: string }>,
): ClaimProvenanceResult {
  const sourceText = `${JSON.stringify(audit)} ${retrieved.map((chunk) => `${chunk.id ?? ""} ${chunk.title ?? ""} ${chunk.text ?? ""}`).join(" ")}`;
  const sourceLower = sourceText.toLowerCase();
  const sourceTokens = new Set(sourceLower.split(/[^a-z0-9]+/).filter((word) => word.length >= 3));
  const sourceNumbers = new Set(sourceText.match(/\d+(?:[.,]\d+)*/g) ?? []);
  const retrievedIds = new Set(retrieved.map((chunk) => chunk.id).filter((id): id is string => Boolean(id)));

  const untracedNumbers: string[] = [];
  const unmappedClaims: string[] = [];
  let checkedClaims = 0;

  for (const sentence of claimSentences(text)) {
    if (META_CLAIM.test(sentence)) continue;

    const citations = [...sentence.matchAll(/\[([a-z0-9][a-z0-9_#.-]{2,})\](?!\()/gi)].map((match) => match[1]!);
    if (citations.length > 0 && citations.every((id) => retrievedIds.has(id))) continue;

    checkedClaims += 1;
    const numbers = Array.from(new Set(sentence.match(/\b\d+(?:\.\d+)?\b/g) ?? []));
    const missingNumbers = numbers.filter((number) => {
      if (sourceNumbers.has(number)) return false;
      // "/100" and "out of 100" are scale denominators, not measured values.
      if (number === "100" && /\/\s*100\b|out of 100\b/i.test(sentence)) return false;
      return true;
    });
    if (missingNumbers.length > 0) {
      untracedNumbers.push(...missingNumbers);
      unmappedClaims.push(sentence);
      continue;
    }

    const words = claimWords(sentence);
    if (words.length === 0) continue;
    const matched = words.filter((word) => {
      return sourceTokens.has(word) || sourceTokens.has(stem(word)) || sourceLower.includes(word);
    });
    const coverage = matched.length / words.length;
    if (coverage < 0.55 && words.length - matched.length > 1) {
      unmappedClaims.push(sentence);
    }
  }

  return {
    ok: untracedNumbers.length === 0 && unmappedClaims.length === 0,
    untracedNumbers: [...new Set(untracedNumbers)],
    unmappedClaims: unmappedClaims.slice(0, 8),
    checkedClaims,
  };
}
