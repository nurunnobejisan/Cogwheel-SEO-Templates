/**
 * Hotel & Hospitality pack — the first vertical pack (docs/TASKS.md Task 2.2).
 *
 * Everything here is assembled from sources that already existed; nothing is
 * re-authored:
 *   - identity + weights  → src/packs/catalog.ts (weights ← data/ota-config.json)
 *   - checklist           → every Critical-priority item in the template
 *                           catalog (./templates.ts), in catalog order
 *   - schema rules        → ./schema-rules.ts (pack form of rules/hotel +
 *                           rules/universal/schema-context clauses)
 *   - keyword matrix      → ./keywords.json (the 78-keyword dataset, moved
 *                           from data/ and revalidated through zod)
 *   - brand guardrails    → ./brand-guardrails.ts (moved from the extension,
 *                           byte-identical; the extension re-exports it)
 *   - ai prompts          → none yet (populated by the AI/ops phase)
 *
 * Registration is guarded so a dev-HMR / serverless module re-evaluation
 * does not throw on the duplicate-id check — the registry itself still
 * refuses duplicates for callers that register explicitly.
 */
import otaConfigJson from "../../../data/ota-config.json";
import { OtaConfigSchema, validateKeywordMatrix } from "../../schemas/validation";
import { getPackMeta } from "../catalog";
import { getPack, registerPack } from "../index";
import type { Pack } from "../types";
import type { ChecklistItem } from "./templates";
import { TEMPLATES_DATA } from "./templates";
import { BRAND_GUARDRAILS as HOTEL_BRAND_GUARDRAILS } from "./brand-guardrails";
import { GENERIC_BRAND_GUARDRAILS } from "../generic-guardrails";
import { HOTEL_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

/**
 * The pack checklist is derived, not duplicated: every Critical-priority
 * checklist item across the hotel template catalog, in catalog order.
 * Template ids are unique, so the derived list is too.
 */
export const HOTEL_CHECKLIST: ChecklistItem[] = TEMPLATES_DATA.flatMap(
  (template) => template.checklist
).filter((item) => item.priority === "Critical");

function buildHotelPack(): Pack {
  const meta = getPackMeta("hotel");
  if (!meta) {
    // catalog.ts always defines it; fail loudly rather than register a husk.
    throw new Error('Pack "hotel" is missing from src/packs/catalog.ts');
  }
  // Parsed through the schema so JSON import types cannot drift from the
  // validated KeywordStrategyMatrix shape (source: "illustrative" literal).
  const keywordMatrix = validateKeywordMatrix(keywordsJson);
  // OTA config is the single source of the shipped weights and pixel limits;
  // parsing it here keeps the pack honest if data/ota-config.json regresses.
  const otaConfig = OtaConfigSchema.parse(otaConfigJson);

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    pageTypes: meta.pageTypes,
    scoringWeights: otaConfig.scoringWeights,
    checklist: HOTEL_CHECKLIST,
    schemaRules: HOTEL_SCHEMA_RULES,
    keywordMatrix,
    // Five franchise rulebooks plus the universal Generic rule, so hotel
    // copy gets the same unsubstantiated-claim checks every other pack has.
    brandGuardrails: { ...HOTEL_BRAND_GUARDRAILS, ...GENERIC_BRAND_GUARDRAILS },
    aiPrompts: [],
  };
}

export const hotelPack: Pack = buildHotelPack();

if (!getPack(hotelPack.id)) {
  registerPack(hotelPack);
}

export default hotelPack;
