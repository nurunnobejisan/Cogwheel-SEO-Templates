import { SECTION_RULES, type HiltonSectionId } from "@/config/hilton-rules";
import type { UspHeadlineInput } from "./schema";

export function buildSectionCopyPrompt(opts: {
  sectionId: HiltonSectionId;
  property: UspHeadlineInput["property"];
  keyword: string;
  demandGenerators: string;
  usps: string[];
  liveCopy: string;
  grandfatheredOutlet: boolean;
  feedback?: string[];
}): { system: string; prompt: string } {
  const rule = SECTION_RULES[opts.sectionId];
  const maxChars =
    opts.sectionId === "dining-outlet" && opts.grandfatheredOutlet && rule.grandfatheredMaxChars
      ? rule.grandfatheredMaxChars
      : rule.maxChars;

  const limitDesc = maxChars
    ? `HARD LIMIT: Final live text (after removing ~~strikethrough~~ and stripping ** markers) MUST be <= ${maxChars} characters.`
    : rule.targetChars
      ? `TARGET LENGTH: Final live text should be approximately ${rule.targetChars} characters (±10%).`
      : "No strict character cap.";

  const system = [
    "You are a Hilton SEO/GEO copywriter.",
    "OUTPUT FORMAT: Return ONLY the revised copy for this single section.",
    "STRICT DIFF MODE: Preserve existing live copy wherever possible. Mark new additions with **bold** and removed words/phrases with ~~strikethrough~~. If no live copy is provided, write clean new copy wrapped in **bold**.",
    limitDesc,
    opts.keyword ? `TARGET KEYWORD: Must naturally include "${opts.keyword}".` : "",
    rule.requiredUsps ? `USPs: Must weave in ${rule.requiredUsps} property USPs from the Discovery Notes.` : "",
    rule.maxLinks ? `LINKS: At most ${rule.maxLinks} link.` : "",
    rule.requiresAdaLegal ? "ADA & JS: Include a concise Hilton ADA legal copy placeholder and JS note at the end." : "",
    opts.sectionId === "events"
      ? "EVENTS RULE: Only fix factual errors and add up to 3 spotlight focus points. Do NOT rewrite the body copy."
      : "",
    opts.feedback?.length
      ? `PREVIOUS ATTEMPT FAILED VALIDATION. Fix these exact issues:\n- ${opts.feedback.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = JSON.stringify(
    {
      section: rule.label,
      property: {
        name: opts.property.name,
        brand: opts.property.brand,
        market: `${opts.property.city}, ${opts.property.state}`,
        url: opts.property.url,
      },
      targetKeyword: opts.keyword || null,
      demandGenerators: opts.demandGenerators,
      usps: opts.usps,
      currentLiveCopy: opts.liveCopy || "(none provided)",
    },
    null,
    2,
  );

  return { system, prompt };
}

