# Vertical Packs — Authoring Guide

A **pack** is the unit that tells the audit engine how to score one vertical:
its page types, score weights, checklist, contextual schema rules, keyword
strategy matrix, brand guardrails and AI prompts. Packs are **data, not code** —
adding a vertical means adding data under `src/packs/<id>/`, never a new branch
in the rules engine.

This is Task 6.2 of [`TASKS.md`](./TASKS.md) (Comprehensive Documentation & Pack Guide).

> **Status:** the `Pack` type and registry are implemented and tested
> (`src/packs/`, `tests/packs-registry.test.ts`), but no pack has been
> extracted into `src/packs/<id>/` yet and nothing in `src/` imports the
> registry. The hotel data still lives in `src/data/` and `src/schemas/`.
> This guide documents the interface as it exists today so the first pack
> extraction (Task 2.2) has a target to hit.

---

## Layout

```
src/packs/
├── types.ts      # Pack, PackPageType, PackSchemaRule, PackAiPrompt
├── index.ts      # validatePack, registerPack, getPack, listPacks, unregisterPack
└── <pack-id>/    # one directory per vertical (Task 2.2+)
    └── index.ts  # exports the Pack object and registers it
```

Import everything from the barrel:

```ts
import { registerPack, getPack, listPacks, validatePack } from "@/packs";
import type { Pack, PackPageType } from "@/packs";
```

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
              targetIndustries, categorySummary },
  categories: ["Brand/Direct Booking", ...],   // ≥1
  keywords: [ { id, keyword, category, subCategory, searchIntent,
                searchVolumeTier, cpcEstimate, targetPageType,
                recommendedSchema, geoEngineRelevance, targetEntityPrompt,
                competitiveContext } ],         // ≥1
}
```

Per Task 4.1, `cpcEstimate` values are illustrative and must be marked
`source: "illustrative"`.

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

> **Known limitation:** `BrandRuleSchema.name` is currently the enum
> `Marriott | Hilton | IHG | Hyatt | Independent`. A non-hotel pack cannot
> declare its own brand keys until that enum is widened. Track this with
> Task 2.3 (Universal Vertical Packs).

---

## Writing a pack

Create `src/packs/<pack-id>/index.ts`:

```ts
import { registerPack } from "../index.ts";
import type { Pack } from "../types.ts";

const pack: Pack = {
  id: "hotel",
  name: "Hotel & Hospitality",
  description: "Scoring, schema and keywords for hotel and hospitality sites.",
  pageTypes: ["home", "location", "booking"],
  scoringWeights: { onPage: 0.5, schema: 0.3, geoAi: 0.2 },
  checklist: [ /* … */ ],
  schemaRules: [ /* … */ ],
  keywordMatrix: { /* … */ },
  brandGuardrails: { /* … */ },
  aiPrompts: [ /* … */ ],
};

registerPack(pack);
export default pack;
```

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

The hotel vertical's data is not yet in a pack directory. Until Task 2.2
lands, the existing sources are:

| Data | Location |
| --- | --- |
| Strategy matrices (per property) | `src/data/trained-keyword-matrices.ts` |
| Checklists / templates | `src/data/templates.ts` |
| Guardrails & matrix schemas | `src/schemas/validation.ts` |
| OTA config, pixel limits, weights | `OtaConfigSchema` in `src/schemas/validation.ts` |
| Rule engine (mode-aware) | `rules/` — `runAudit(snapshot, options)` |
| Mode detection | `rules/context/detect-mode.ts` |

## Checklist for a new pack PR

1. [ ] `src/packs/<id>/index.ts` exports a `Pack` and registers it.
2. [ ] `validatePack(pack)` returns `[]`.
3. [ ] Weights sum to 1; every `pageType` is in the `PackPageType` set.
4. [ ] `aiPrompts` IDs are unique; `{{placeholders}}` resolve via the variable resolver.
5. [ ] `keywordMatrix.cpcEstimate` is marked `source: "illustrative"`.
6. [ ] A test registers the pack and asserts `getPack(<id>)`.
7. [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.
8. [ ] This guide's table is updated if you add or change a `Pack` field.
