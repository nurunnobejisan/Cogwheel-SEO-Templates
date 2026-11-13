import { isHalfAndHalfEligible, keywordForSection, SECTION_RULES } from "@/config/hilton-rules";
import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import { upsertPropertyProfile } from "@/core/property";
import type { SectionValidationResult } from "@/lib/hilton-validator";
import { TaskExecutionError } from "@/tasks/keyword-research";
import { buildSectionCopyPrompt } from "./prompt";
import { renderUspHeadlineDoc, type UspHeadlineOutput } from "./render";
import { HILTON_SECTION_IDS, uspHeadlineInputSchema, type UspHeadlineInput } from "./schema";
import { collectSectionFlags, validateSingleSection, type GeneratedSectionsDraft } from "./validator";

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

export async function runUspHeadlineTask(
  rawInput: unknown,
): Promise<PipelineResult<UspHeadlineOutput>> {
  const parsed = uspHeadlineInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  if (!isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const input = parsed.data;
  const { propertyId } = await upsertPropertyProfile(input.property).catch(() => ({ propertyId: null }));

  return runTaskPipeline<UspHeadlineInput, { usps: string[] }, GeneratedSectionsDraft, UspHeadlineOutput>({
    taskId: "usp-headline-optimization",
    propertyId,
    schema: uspHeadlineInputSchema,
    rawInput: input,
    maxRetries: 0, // per-section retry up to 2x is handled inside draftWithClaude
    fetchData: async (inp) => ({
      usps: inp.discoveryNotes.usps.map((u) => u.trim()).filter(Boolean),
    }),
    draftWithClaude: async ({ input: inp, data }) => {
      const generated = await mapWithConcurrency(HILTON_SECTION_IDS, SECTION_CONCURRENCY, async (sectionId) => {
        const rule = SECTION_RULES[sectionId];
        const keyword = keywordForSection(sectionId, inp.matrix);
        const current = inp.liveCopy[sectionId] ?? "";

        if (sectionId === "half-and-half") {
          const eligible = isHalfAndHalfEligible(inp.property.brand);
          const val = eligible
            ? `Yes — ${inp.property.brand} is eligible for Half & Half.`
            : `No — ${inp.property.brand || "this brand"} is not on the Half & Half list.`;
          return {
            sectionId,
            text: val,
            validation: validateSingleSection({ sectionId, text: val, brand: inp.property.brand }),
            retries: 0,
          };
        }

        if (rule.mode === "boilerplate") {
          const val = current || `[Fixed Hilton boilerplate for ${rule.label} — no generation]`;
          return {
            sectionId,
            text: val,
            validation: validateSingleSection({ sectionId, text: val }),
            retries: 0,
          };
        }

        let attempt = 0;
        let feedback: string[] | undefined;
        let draft = "";
        let check: SectionValidationResult;

        while (true) {
          const { system, prompt } = buildSectionCopyPrompt({
            sectionId,
            property: inp.property,
            keyword,
            demandGenerators: inp.discoveryNotes.demandGenerators,
            usps: data.usps,
            liveCopy: current,
            grandfatheredOutlet: inp.grandfatheredOutlet,
            feedback,
          });
          draft = (await generateClaudeText({ system, prompt, maxTokens: 900 })).trim();
          check = validateSingleSection({
            sectionId,
            text: draft,
            keyword,
            usps: data.usps,
            brand: inp.property.brand,
            grandfathered: inp.grandfatheredOutlet,
            requiresAdaLegal: rule.requiresAdaLegal,
            requiresJsNote: rule.requiresJsNote,
          });
          if (check.valid || attempt >= MAX_RETRIES) break;
          attempt += 1;
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
      return { sections, validation, retries };
    },
    validate: async ({ draft }) => collectSectionFlags(draft),
    renderTemplate: async ({ input: inp, draft }) => {
      const output = await renderUspHeadlineDoc(inp, draft);
      return { outputUrl: output.docUrl, output };
    },
  });
}

