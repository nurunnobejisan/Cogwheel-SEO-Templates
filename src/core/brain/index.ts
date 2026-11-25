import "server-only";

import { runFullWebsiteAudit } from "@/core/full-audit";
import { loadRepoCorpus } from "./corpus";
import { canUseLlm, recordLlmUsage } from "./usage";
import { createRagPipeline, type RagPipeline } from "../../../ai/rag";
import { generateClaudeText, isClaudeConfigured } from "@/core/claude";

export const BRAIN_SYSTEM_PROMPT = `You are the Cogwheel SEO Brain.

You interpret a MEASURED audit produced by the Cogwheel audit engine. The audit
report contains only facts measured from the live page, plus sections explicitly
labelled "estimated" or "unavailable".

HARD CONSTRAINTS (non-negotiable):
1. Never invent rankings, search volumes, AI citations, competitor names, fees,
   revenue figures, or benchmark scores.
2. If a dimension is unavailable or unmeasured, say so plainly; do not fill gaps
   with plausible-sounding numbers.
3. Every claim must trace to a measured field in the audit report or to a
   retrieved knowledge-base chunk. Cite the chunk id in brackets when you rely on
   it, e.g. [kc-title-tag].
4. Prefer "not measured" over guessing. "Measure, label, or leave blank."
5. Output structured JSON only when asked for JSON; otherwise concise markdown.`;

export interface BrainRequest {
  targetUrl: string;
  question?: string;
  maxPages?: number;
}

export interface BrainResult {
  targetUrl: string;
  audit: Awaited<ReturnType<typeof runFullWebsiteAudit>>;
  retrieved: Array<{ id: string; title: string; source: string; score: number }>;
  interpretation: string;
  provider: string;
  generatedAt: string;
}

let cachedPipeline: RagPipeline | null = null;
async function getPipeline(): Promise<RagPipeline> {
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
  const audit = await runFullWebsiteAudit({
    targetUrl,
    maxPages: request.maxPages ?? 10,
    includeGsc: true,
    includeGeo: true,
  });

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
    topActions: (audit.actionPlan ?? []).slice(0, 15).map((a) => ({ priority: a.priority, title: a.title, category: a.category })),
  };
  const auditJson = JSON.stringify(compactAudit, null, 2);
  const contextText = retrieved
    .map((c) => `[${c.id}] ${c.title} (${c.source}, score ${c.score})\n${c.text}`)
    .join("\n\n");

  const prompt = `AUDIT REPORT (measured facts only):\n${auditJson}\n\nRETRIEVED KNOWLEDGE:\n${contextText}\n\nUSER QUESTION:\n${request.question?.trim() || "Summarise the top issues and the safest next actions."}\n\nRespond with a concise, grounded summary. Mark any unavailable dimension explicitly.`;

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

  const provenance = verifyProvenance(interpretation, audit, retrieved);
  if (!provenance.ok && provider === "llm") {
    interpretation = deterministicInterpretation(audit, retrieved);
    provider = "deterministic (provenance gate)";
  }

  return {
    targetUrl,
    audit,
    retrieved: retrieved.map((c: { id: string; title: string; source: string; score: number }) => ({ id: c.id, title: c.title, source: c.source, score: c.score })),
    interpretation,
    provider,
    generatedAt: new Date().toISOString(),
  };
}

function deterministicInterpretation(audit: Awaited<ReturnType<typeof runFullWebsiteAudit>>, retrieved: ReturnType<RagPipeline["knowledgeBase"]["search"]>): string {
  const plan = audit.actionPlan ?? [];
  const lines: string[] = [];
  lines.push(`# Measured audit summary for ${audit.targetUrl ?? audit.domain}`);
  lines.push("");
  lines.push(`- Overall score: ${audit.overallScore}/100`);
  lines.push(`- Action items: ${plan.length}`);
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
  audit: Awaited<ReturnType<typeof runFullWebsiteAudit>>,
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
