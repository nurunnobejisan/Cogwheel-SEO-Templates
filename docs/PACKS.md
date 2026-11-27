# Vertical Packs — Authoring Guide

A **pack** is the unit that tells the audit engine how to score one vertical:
its page types, score weights, checklist, contextual schema rules, keyword
strategy matrix, brand guardrails and AI prompts. Packs are **data, not code** —
adding a vertical means adding data under `src/packs/<id>/`, never a new branch
in the rules engine.

This is Task 6.2 of [`TASKS.md`](./TASKS.md) (Comprehensive Documentation & Pack Guide).

> **Status:** all six packs are implemented and tested (Tasks 2.2–2.3).
> `src/packs/hotel/` holds the extracted hotel data (guardrails, templates,
> schema rules, checklist, `keywords.json`), and `ecommerce`,
> `local-business`, `saas`, `publisher` and `finance` each ship the same
> three-file contract. `tests/packs-parity.test.ts` fails the moment the
> light catalog and the full pack modules drift apart.

---

## Layout

```
src/packs/
├── types.ts               # Pack, PackPageType, PackSchemaRule, ChecklistItem re-export
├── index.ts               # validatePack, registerPack, getPack, listPacks, KNOWN_PAGE_TYPES
├── catalog.ts             # PACK_CATALOG light projection (id/name/pageTypes/weights/signals)
│                          #   ← the ONLY pack module the extension may import
├── all.ts                 # ALL_PACKS / findPack — full packs for server + tests
├── matrices.ts            # getPackMatrix / resolveMatrixPackId — all six keywords.json,
│                          #   validated at module load (server-side, /strategy-matrix)
├── clusters.ts            # clusterByTargetPageType — target-page cluster view (Task 4.3)
├── suggest.ts             # suggestPack() heuristics (Task 2.4)
├── classifier.ts          # rule-based page-type classifier (Task 3.1)
├── generic-guardrails.ts  # GENERIC_BRAND_GUARDRAILS shared by every pack
└── <pack-id>/             # one directory per vertical — six exist today
    ├── index.ts           # exports the Pack, guarded: if (!getPack(id)) registerPack(pack)
    ├── keywords.json      # 78-row / 6-category × 13 strategy matrix (Task 4.1)
    └── schema-rules.ts    # PackSchemaRule[] for the vertical
    # hotel additionally owns brand-guardrails.ts and templates.ts
```

Import everything from the barrel:

```ts
import { registerPack, getPack, listPacks, validatePack } from "@/packs";
import type { Pack, PackPageType } from "@/packs";
```

Product surfaces must pick the cheapest correct view:

| Surface | Import |
| --- | --- |
| Extension (popup, sidepanel, options, background) | `src/packs/catalog.ts` (+ `suggest.ts`, `classifier.ts`, `generic-guardrails.ts`) — never `matrices.ts`/`all.ts` (≈360 KB of JSON) |
| Server routes (`/strategy-matrix`) | `src/packs/matrices.ts` |
| Tests and server-side tooling | `src/packs/all.ts` |

---

## The `Pack` interface

All nine fields are required (`src/packs/types.ts`):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Stable lowercase kebab-case slug. Used in settings, URLs and the `src/packs/<id>/` directory name. |
| `name` | `string` | Human-readable name shown in the pack selector, e.g. `"Hotel & Hospitality"`. Must not be blank. |
| `description` | `string` | One-line summary shown under the name in the selector. |
| `pageTypes` | `PackPageType[]` | At least one. The page types this vertical's scoring and rules are tuned for. |
| `scoringWeights` | `ScoringWeights` | `{ onPage, schema, geoAi }`, each `0…1`, **must sum to 1**. |
| `checklist` | `ChecklistItem[]` | At least one. Rendered in the audit side panel. |
| `schemaRules` | `PackSchemaRule[]` | Contextual JSON-LD requirements layered on top of `rules/`. May be empty. |
| `keywordMatrix` | `KeywordStrategyMatrix` | Full strategy matrix; `keywords` must contain at least one entry. |
| `brandGuardrails` | `AllBrandGuardrails` | Keyed by brand name; must define at least one brand. |
| `aiPrompts` | `PackAiPrompt[]` | Prompts for metadata/content/schema/geo generation. IDs must be unique. May be empty. |

### `PackPageType`

```
"home" | "product" | "category" | "article" | "location" | "booking" | "contact" | "other"
```

These are the values the page-type classifier (Task 3.1) can emit. A pack may
only list values from this set — anything else is rejected at registration.

### `ScoringWeights`

```ts
scoringWeights: { onPage: 0.5, schema: 0.3, geoAi: 0.2 }  // sums to 1 ✓
```

The sum is checked with a `1e-6` epsilon, so floating-point weights are fine.
A pack whose weights sum to anything else fails validation with
`scoringWeights must sum to 1, got <total>`.

### `ChecklistItem`

```ts
{ id: "canonical-hotel", task: "Set a self-referencing canonical",
  description: "Each bookable room URL points at itself.",
  priority: "Critical" }   // "Critical" | "High" | "Medium"
```

### `PackSchemaRule`

Scoped to the page types where it applies, so a rule can demand `Hotel` on
`home`/`location` without firing on `article` pages:

```ts
{
  jsonLdType: "Hotel",
  pageTypes: ["home", "location"],
  required: ["name", "address", "telephone"],
  recommended: ["starRating", "amenityFeature"],
  rationale: "Hotel rich results require name, address and telephone.",
}
```

`rationale` is surfaced verbatim in audit output — write it for the operator
who has to act on it.

### `PackAiPrompt`

```ts
{
  id: "meta-title",
  purpose: "metadata",   // "metadata" | "content" | "schema" | "geo"
  system: "You write search-optimized metadata.",
  template: "Write a title for {{pageUrl}} targeting {{primaryKeyword}}.",
}
```

`{{placeholders}}` are resolved by the existing variable resolver. `system`
must not embed brand-specific absolutes — those belong in `brandGuardrails`.

### `KeywordStrategyMatrix`

Validated by `KeywordStrategyMatrixSchema` in `src/schemas/validation.ts`:

```ts
{
  metadata: { version, datasetName, totalKeywords, lastUpdated, author,
              targetIndustries, categorySummary, notes? },
  categories: ["Brand/Direct Booking", ...],   // ≥1, pack-defined
  keywords: [ { id, keyword, category, subCategory, searchIntent,
                searchVolumeTier, cpcEstimate: { value, source: "illustrative" },
                targetPageType, recommendedSchema, geoEngineRelevance,
                targetEntityPrompt, competitiveContext } ],  // ≥1
}
```

Per Task 4.1, every `cpcEstimate` carries `{ value, source: "illustrative" }`
— `source` only accepts the literal `"illustrative"`, because no measured CPC
data exists for these datasets. `metadata.notes` states the same provenance
for the volume tiers in plain words.

### `AllBrandGuardrails`

```ts
{
  Marriott: {
    name: "Marriott",
    loyaltyProgram: "Marriott Bonvoy",
    maxTitleChars: 60, maxMetaChars: 160, maxH1Chars: 70,
    brandPillColor: "#FFC72C",
    forbiddenTerms: [{ term: "cheap", reason: "…", replacement: "value" }],
  },
}
```

> **Widened in Phase C:** `BrandRuleSchema.name` and the guardrail record keys
> now include `Generic`, so non-hotel packs declare universal guardrails under
> a single `Generic` key (Task 2.3). `mandatorySuffix` is optional — hotel
> franchise brands use it, everyone else omits it.

---

## Writing a pack

Create `src/packs/<pack-id>/index.ts` (mirror an existing pack —
`src/packs/finance/index.ts` is a clean reference):

```ts
import { getPack, registerPack } from "../index";
import { getPackMeta } from "../catalog";
import { GENERIC_BRAND_GUARDRAILS } from "../generic-guardrails";
import { validateKeywordMatrix } from "../../schemas/validation";
import type { Pack, ChecklistItem } from "../types";
import { MY_SCHEMA_RULES } from "./schema-rules";
import keywordsJson from "./keywords.json";

export const MY_CHECKLIST: ChecklistItem[] = [ /* 6-10 real items */ ];

const pack: Pack = {
  id: "my-pack",
  name: getPackMeta("my-pack")?.name ?? "My Pack",
  description: getPackMeta("my-pack")?.description ?? "",
  pageTypes: getPackMeta("my-pack")?.pageTypes ?? ["home"],
  // NEVER hardcode weights: the catalog (and data/ota-config.json for hotel)
  // is the single source, so the selector, the gauge and the composite can
  // never disagree with the pack.
  scoringWeights: getPackMeta("my-pack")?.scoringWeights ?? { onPage: 0.35, schema: 0.35, geoAi: 0.3 },
  checklist: MY_CHECKLIST,
  schemaRules: MY_SCHEMA_RULES,
  keywordMatrix: validateKeywordMatrix(keywordsJson),
  brandGuardrails: GENERIC_BRAND_GUARDRAILS,
  aiPrompts: [],
};

// Guarded so HMR / vitest module reuse never trips the duplicate-id check.
if (!getPack(pack.id)) registerPack(pack);
export default pack;
```

A new pack also joins three shared registries (all locked by
`tests/packs-parity.test.ts`): `PACK_CATALOG` in `catalog.ts`, `ALL_PACKS`
in `all.ts`, and the `MATRIX_JSON` map in `matrices.ts`.

### Validate before you register

`registerPack` throws with the **full list** of problems rather than failing on
the first one, and refuses duplicate IDs so a rename cannot silently shadow an
existing pack. To check without throwing:

```ts
const problems = validatePack(pack);
if (problems.length) console.warn(problems);
```

Validation rules, exactly as enforced:

| Check | Failure message |
| --- | --- |
| `id` matches `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` | `id "…" must be a lowercase kebab-case slug` |
| `name` non-blank | `name must not be empty` |
| `pageTypes` non-empty | `pageTypes must list at least one page type` |
| every page type is a `PackPageType` | `unknown pageType "…"` |
| weights sum to 1 (±1e-6) | `scoringWeights must sum to 1, got …` |
| `checklist` non-empty | `checklist must contain at least one item` |
| `keywordMatrix.keywords` non-empty | `keywordMatrix must contain at least one keyword` |
| `brandGuardrails` non-empty | `brandGuardrails must define at least one brand` |
| `aiPrompts` ids unique | `duplicate aiPrompt id "…"` |
| id not already registered | `Pack "…" is already registered` (thrown by `registerPack`) |

### Testing your pack

```ts
import { validatePack, registerPack, getPack, unregisterPack } from "../src/packs";

it("registers the my-pack pack", () => {
  expect(validatePack(pack)).toEqual([]);   // no problems
  registerPack(pack);
  expect(getPack("my-pack")).toBe(pack);
  unregisterPack("my-pack");                // registry is module-global
});
```

The registry is a module-level `Map`, so tests should `unregisterPack` in
`beforeEach`/`afterEach` to avoid leaking state between files. See
`tests/packs-registry.test.ts` for the full pattern.

---

## Where pack data comes from today

All six packs live under `src/packs/<id>/` (Task 2.2/2.3 done). The shared
sources they build on:

| Data | Location |
| --- | --- |
| Per-pack matrices | `src/packs/<id>/keywords.json` (server view: `src/packs/matrices.ts`) |
| Hotel checklists / templates | `src/packs/hotel/templates.ts` |
| Guardrails | `src/packs/hotel/brand-guardrails.ts` (five franchise rulebooks) + `src/packs/generic-guardrails.ts` (shared `Generic`) |
| Matrix & pack schemas | `src/schemas/validation.ts` |
| OTA config, pixel limits, hotel weights | `data/ota-config.json` (`OtaConfigSchema`) |
| Pack identity/weights/signals | `src/packs/catalog.ts` |
| Rule engine (mode-aware) | `rules/` — `runAudit(snapshot, options)` |
| Contextual schema rules (Task 3.3) | `rules/universal/schema-context.ts` |
| Mode detection | `rules/context/detect-mode.ts` |

## Checklist for a new pack PR

1. [ ] `src/packs/<id>/index.ts` exports a `Pack` and registers it **guarded** (`if (!getPack(id))`).
2. [ ] `validatePack(pack)` returns `[]`.
3. [ ] Weights come from `getPackMeta(<id>)` — never a hardcoded triple; every `pageType` is in the `PackPageType` set.
4. [ ] `aiPrompts` IDs are unique; `{{placeholders}}` resolve via the variable resolver.
5. [ ] `keywordMatrix` is `keywords.json` with `cpcEstimate` marked `source: "illustrative"` and a `metadata.notes` provenance sentence.
6. [ ] The pack is added to `PACK_CATALOG`, `ALL_PACKS` and `matrices.ts`'s `MATRIX_JSON`.
7. [ ] `brandGuardrails` is `GENERIC_BRAND_GUARDRAILS` (or spreads it alongside vertical-specific rules).
8. [ ] A test registers the pack and asserts `getPack(<id>)`; `tests/packs-parity.test.ts` passes unchanged.
9. [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.
10. [ ] This guide's table is updated if you add or change a `Pack` field.
