import { TEMPLATES } from "@/config/templates";
import type { RationaleEntry } from "@/core/google";
import type { MatrixRow } from "@/lib/types";
import type { ResolvedKeywordRun } from "./schema";

export function buildRationalePrompt(
  run: ResolvedKeywordRun,
  feedback?: string[],
): { system: string; prompt: string } {
  const tmpl = TEMPLATES[run.template];
  const rStyle = run.property.rationaleStyle ?? (run.template === "B" ? "reitz" : "catbird");
  const styleGuide: Record<"arrive" | "catbird" | "reitz", string> = {
    arrive: `Arrive style: Write 1-2 crisp, direct sentences per page for "${tmpl.rationaleHeading}", citing the primary keyword, SV, KD, and page alignment.`,
    catbird: `Catbird style: Write 2-3 sentences per page for "${tmpl.rationaleHeading}" citing primary keyword, SV, KD, and traffic potential, PLUS a final sentence starting with "Supporting it with related ..." when relevant.`,
    reitz: `Cogwheel / Reitz style: Write a qualitative, strategic 3-sentence paragraph per page for "${tmpl.rationaleHeading}" covering demand-generator fit, SV/KD opportunity, and primary + secondary keyword pairing.`,
  };

  const system = [
    "You are an expert hospitality SEO strategist writing keyword recommendation rationales for hotel properties.",
    styleGuide[rStyle],
    "STRICT GROUNDING RULE: Only cite metrics (Search Volume, KD, bucket, flags) explicitly provided in the input JSON. Never invent numbers, rankings, or traffic estimates.",
    'Return ONLY valid JSON matching: {"rationales":[{"pageId":"...","title":"...","text":"..."}]}',
    feedback?.length ? `PREVIOUS ATTEMPT ISSUES:\n- ${feedback.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    property: {
      name: run.property.name,
      url: run.property.url || undefined,
      brand: run.property.brand || undefined,
      market: `${run.property.city}, ${run.property.state}`,
      notes: run.property.notes || undefined,
    },
    template: tmpl.name,
    pages: run.matrix.map((r) => ({
      pageId: r.pageId,
      title: r.title,
      path: r.path,
      primary: r.primary ? { keyword: r.primary.keyword, sv: r.primary.volume, kd: r.primary.kd } : null,
      secondary: r.secondary ? { keyword: r.secondary.keyword, sv: r.secondary.volume, kd: r.secondary.kd } : null,
      flags: r.flags,
    })),
  };

  return { system, prompt: JSON.stringify(payload, null, 2) };
}

export function parseRationales(raw: string, matrix: MatrixRow[]): RationaleEntry[] {
  const withoutFences = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonText = withoutFences.match(/\{[\s\S]*\}/)?.[0] ?? withoutFences;
  const parsed = JSON.parse(jsonText) as { rationales?: RationaleEntry[] };
  if (!Array.isArray(parsed.rationales)) throw new Error("LLM response missing rationales array");
  const byId = new Map(parsed.rationales.map((r) => [r.pageId, r]));
  return matrix.map((m) => {
    const found = byId.get(m.pageId);
    return {
      pageId: m.pageId,
      title: m.title,
      text:
        found?.text?.trim() ||
        `Selected "${m.primary?.keyword ?? "N/A"}" (SV ${m.primary?.volume ?? 0}, KD ${m.primary?.kd ?? "N/A"}) for ${m.title}.`,
    };
  });
}

export function buildDeterministicRationales(matrix: MatrixRow[]): RationaleEntry[] {
  return matrix.map((m) => ({
    pageId: m.pageId,
    title: m.title,
    text: m.primary
      ? `Target "${m.primary.keyword}" (${m.primary.volume.toLocaleString()} monthly searches, KD ${m.primary.kd ?? "N/A"}) on ${m.title} (${m.path})${m.secondary ? `, paired with secondary keyword "${m.secondary.keyword}" (${m.secondary.volume.toLocaleString()} SV)` : ""}.`
      : `No primary keyword assigned for ${m.title} (${m.path}).`,
  }));
}

