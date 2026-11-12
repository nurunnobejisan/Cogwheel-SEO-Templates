import { NextResponse } from "next/server";
import { z } from "zod";
import { isHalfAndHalfEligible, keywordForSection, SECTION_RULES, type HiltonSectionId } from "@/config/hilton-rules";
import { createHiltonContentDoc, isGoogleConfigured } from "@/lib/google";
import { validateSection, type SectionValidationResult } from "@/lib/hilton-validator";
import { generateText } from "@/lib/llm";
import { propertySchema } from "@/lib/schemas";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const SECTION_IDS: HiltonSectionId[] = [
  "home-headline",
  "home-description",
  "usp-callout",
  "half-and-half",
  "location",
  "dining-main",
  "dining-outlet",
  "rooms",
  "suites",
  "hotel-info",
  "offers",
  "gallery",
  "events",
];

const requestSchema = z.object({
  runId: z.string().uuid().optional(),
  property: propertySchema,
  matrix: z.array(
    z.object({
      pageId: z.string(),
      path: z.string(),
      title: z.string(),
      primary: z.object({ keyword: z.string(), volume: z.number(), kd: z.number().nullable() }).nullable(),
      secondary: z.object({ keyword: z.string(), volume: z.number(), kd: z.number().nullable() }).nullable().optional(),
    }),
  ),
  discoveryNotes: z.object({
    demandGenerators: z.string().default(""),
    usps: z.array(z.string()).default([]),
  }),
  liveCopy: z.record(z.string()).default({}),
  grandfatheredOutlet: z.boolean().default(false),
  generateDoc: z.boolean().default(true),
});

const MAX_RETRIES = 2;
const SECTION_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
  return results;
}

async function generateSectionCopy(opts: {
  sectionId: HiltonSectionId;
  property: z.infer<typeof requestSchema>["property"];
  keyword: string;
  demandGenerators: string;
  usps: string[];
  liveCopy: string;
  grandfatheredOutlet: boolean;
  feedback?: string[];
}): Promise<string> {
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

  return (await generateText({ system, prompt, maxTokens: 900 })).trim();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }

  const { property, matrix, discoveryNotes, liveCopy, grandfatheredOutlet, generateDoc, runId } = parsed.data;
  const usps = discoveryNotes.usps.map((u) => u.trim()).filter(Boolean);

  const generated = await mapWithConcurrency(SECTION_IDS, SECTION_CONCURRENCY, async (sectionId) => {
    const rule = SECTION_RULES[sectionId];
    const keyword = keywordForSection(sectionId, matrix);
    const current = liveCopy[sectionId] ?? "";

    if (sectionId === "half-and-half") {
      const eligible = isHalfAndHalfEligible(property.brand);
      const val = eligible
        ? `Yes — ${property.brand} is eligible for Half & Half.`
        : `No — ${property.brand || "this brand"} is not on the Half & Half list.`;
      return {
        sectionId,
        text: val,
        validation: validateSection({ sectionId, text: val, brand: property.brand }),
        retries: 0,
      };
    }

    if (rule.mode === "boilerplate") {
      const val = current || `[Fixed Hilton boilerplate for ${rule.label} — no generation]`;
      return {
        sectionId,
        text: val,
        validation: validateSection({ sectionId, text: val }),
        retries: 0,
      };
    }

    let attempt = 0;
    let feedback: string[] | undefined;
    let draft = "";
    let check: SectionValidationResult;

    while (true) {
      draft = await generateSectionCopy({
        sectionId,
        property,
        keyword,
        demandGenerators: discoveryNotes.demandGenerators,
        usps,
        liveCopy: current,
        grandfatheredOutlet,
        feedback,
      });
      check = validateSection({
        sectionId,
        text: draft,
        keyword,
        usps,
        brand: property.brand,
        grandfathered: grandfatheredOutlet,
        adaLegalIncluded: rule.requiresAdaLegal ? /ada|accessible|accessibility/i.test(draft) : undefined,
        jsNoteIncluded: rule.requiresJsNote ? /js|javascript/i.test(draft) : undefined,
      });
      if (check.valid || attempt >= MAX_RETRIES) break;
      attempt++;
      feedback = check.violations;
    }

    return { sectionId, text: draft, validation: check, retries: attempt };
  });

  const sections: Record<string, string> = {};
  const validation: Record<string, SectionValidationResult> = {};
  const retries: Record<string, number> = {};
  for (const item of generated) {
    sections[item.sectionId] = item.text;
    validation[item.sectionId] = item.validation;
    retries[item.sectionId] = item.retries;
  }

  let docId: string | null = null;
  let docUrl: string | null = null;
  let usedTemplateCopy = false;
  let strippedInstructionsCount = 0;
  let googleWarning: string | null = null;

  if (generateDoc) {
    if (!isGoogleConfigured()) {
      googleWarning = "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64); skipped Doc creation.";
    } else {
      try {
        const doc = await createHiltonContentDoc({
          property,
          sections: SECTION_IDS.map((id) => ({
            id,
            label: SECTION_RULES[id].label,
            keyword: keywordForSection(id, matrix) || undefined,
            content: sections[id],
          })),
        });
        docId = doc.docId;
        docUrl = doc.docUrl;
        usedTemplateCopy = doc.usedTemplateCopy;
        strippedInstructionsCount = doc.strippedInstructionsCount;
      } catch (e) {
        googleWarning = `Google Doc creation failed (copy was still generated below): ${(e as Error).message}`;
      }
    }
  }

  if (runId && isSupabaseConfigured()) {
    await getSupabase().from("runs").update({ status: "copy_generated" }).eq("id", runId);
  }

  return NextResponse.json({
    sections,
    validation,
    retries,
    docId,
    docUrl,
    usedTemplateCopy,
    strippedInstructionsCount,
    googleWarning,
  });
}
