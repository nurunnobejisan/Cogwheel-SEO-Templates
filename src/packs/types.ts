/**
 * Vertical Pack — core types (docs/TASKS.md Task 2.1).
 *
 * A Pack bundles everything the audit engine, strategy matrix and AI layers
 * need to score one vertical (hotel first, then ecommerce, local-business,
 * saas, publisher, finance). Packs are data, not code: adding a vertical
 * means adding a directory under `src/packs/<id>/`, never a new branch in
 * the rules engine.
 *
 * Reuses the existing validated shapes so a Pack never invents a second
 * definition of a keyword row, brand rule or scoring weight:
 *   - ScoringWeights / KeywordStrategyMatrix / AllBrandGuardrails → schemas/validation
 *   - ChecklistItem → packs/hotel/templates (the template catalog moved with
 *     the hotel pack in Task 2.2; the shape itself is vertical-agnostic)
 */
import type {
  AllBrandGuardrails,
  KeywordStrategyMatrix,
  ScoringWeights,
} from "../schemas/validation";
import type { ChecklistItem } from "./hotel/templates";

/** Re-exported so pack modules never reach into the hotel directory for a type. */
export type { ChecklistItem };

/** Page types the classifier can assign (docs/TASKS.md Task 3.1 vocabulary). */
export type PackPageType =
  | "home"
  | "product"
  | "category"
  | "article"
  | "location"
  | "booking"
  | "contact"
  | "other";

/** One contextual schema requirement scoped to the page types it applies to. */
export interface PackSchemaRule {
  /** JSON-LD @type this rule targets, e.g. "Hotel" or "Product". */
  jsonLdType: string;
  /** Page types where this rule is enforced. */
  pageTypes: PackPageType[];
  /** Properties that must be present when the type appears on those pages. */
  required: string[];
  /** Properties worth adding when absent; reported as recommendations. */
  recommended?: string[];
  /** Why the rule exists — surfaced verbatim in audit output. */
  rationale: string;
}

/** One reusable AI prompt bound to a pack (metadata, content, schema, GEO). */
export interface PackAiPrompt {
  id: string;
  purpose: "metadata" | "content" | "schema" | "geo";
  /** System-level instruction; must not embed brand-specific absolutes. */
  system: string;
  /** User template; `{{placeholders}}` resolve via variableResolver. */
  template: string;
}

/**
 * A vertical pack: the single unit the UI, strategy matrix and scoring
 * pipeline consume when a vertical is selected.
 */
export interface Pack {
  /** Stable slug used in settings, URLs and `packs/<id>/` directories. */
  id: string;
  /** Human-readable vertical name, e.g. "Hotel & Hospitality". */
  name: string;
  /** Short description shown in the pack selector. */
  description: string;
  /** Page types this vertical's scoring and rules are tuned for. */
  pageTypes: PackPageType[];
  /** Relative score weights; must sum to 1 (validated in the registry). */
  scoringWeights: ScoringWeights;
  /** Vertical-specific checklist rendered in the audit side panel. */
  checklist: ChecklistItem[];
  /** Contextual JSON-LD requirements layered on top of rules/. */
  schemaRules: PackSchemaRule[];
  /** Full keyword strategy matrix for this vertical. */
  keywordMatrix: KeywordStrategyMatrix;
  /** Brand guardrails keyed by brand name (hotel: Marriott/Hilton/...). */
  brandGuardrails: AllBrandGuardrails;
  /** AI prompts this vertical uses for generation and repair suggestions. */
  aiPrompts: PackAiPrompt[];
}
