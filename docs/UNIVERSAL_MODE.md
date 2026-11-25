# Universal Mode — Implementation Notes (Phase 1)

Implements **Phase 1** of [`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md):
the Domain & Context Detection Layer, the Universal rule engine, the manual
mode override store, and the standardized AuditReport payload.

Hotel Mode is untouched. The new engine is a parallel, non-blocking extension:
when a page is not classified as hospitality, the Hotel ruleset simply does not run.

## Layout

```
rules/
├── index.ts                 # runAudit(snapshot, options) → AuditReport
├── types.ts                 # shared mode-aware types + PageSnapshot
├── issues.ts                # issue factory + severity scoring
├── schema.ts                # strict Zod validation of the AuditReport
├── html-snapshot.ts         # lightweight HTML → PageSnapshot fallback
├── context/
│   ├── detect-mode.ts       # automatic hotel-signal detection + mode resolution
│   └── mode-override.ts     # per-domain manual override (memory / localStorage)
├── universal/
│   ├── metadata.ts          # Pillar 1 — title, meta description, headings
│   ├── content.ts           # Pillar 2 — thin content, readability, density
│   ├── media.ts             # Pillar 3 — alt text, formats, dimensions, oversizing
│   └── technical.ts         # Pillar 4 — canonical, indexability, links, OG/Twitter, schema
└── hotel/
    └── index.ts             # hospitality-only checks (additive to Universal)
```

## Flow

```ts
import { runAudit, buildSnapshotFromHtml, validateAuditReport } from "@/../rules/index.ts";

const snapshot = buildSnapshotFromHtml(rawHtml, url); // or a DOM-extracted snapshot
const report = runAudit(snapshot, { overrideStore });
validateAuditReport(report); // strict contract for the AI/CMS layers
```

1. **Detect** — `resolveAuditMode()` checks the manual per-domain override first, then
   automatic triggers: LodgingBusiness-family JSON-LD types, booking-engine script
   signatures (SynXis, TravelClick, Mews, Cloudbeds, …), reservation widgets, and
   booking query parameters (`checkin`, `rooms`, `guests`, …).
2. **Run** — Universal Mode runs the four universal pillars. Hotel Mode runs the
   universal pillars **plus** the hospitality ruleset.
3. **Emit** — a normalized `AuditReport` with `mode`, `modeDetection`, `issues`
   (each carrying `fixable` + `cmsTargetField` for the auto-fix engine) and a
   severity-weighted `summary.score`.

## Rule ids

| Pillar | Issue ids |
| --- | --- |
| Metadata | `iss_title_missing`, `iss_title_too_short/_too_long`, `iss_meta_desc_missing`, `iss_meta_desc_too_short/_too_long`, `iss_h1_missing`, `iss_h1_multiple`, `iss_heading_empty`, `iss_heading_hierarchy_skip` |
| Content | `iss_thin_content`, `iss_readability_low`, `iss_keyword_stuffing` |
| Media | `iss_img_alt_missing`, `iss_img_legacy_format`, `iss_img_missing_dimensions`, `iss_img_oversized` |
| Technical | `iss_canonical_missing`, `iss_canonical_mismatch`, `iss_noindex`, `iss_broken_internal_link`, `iss_redirect_chain`, `iss_external_link_rel`, `iss_viewport_missing`, `iss_og_*`, `iss_twitter_card_missing`, `iss_structured_data_missing` |
| Hospitality | `iss_hotel_schema_missing`, `iss_hotel_schema_property_missing`, `iss_hotel_schema_property_recommended_missing`, `iss_hotel_booking_engine_missing` |

## Manual mode override

```ts
import { createLocalStorageOverrideStore } from "@/../rules/context/mode-override.ts";

const store = createLocalStorageOverrideStore()!;
store.set("example.com", "hotel"); // pin a domain to Hotel Mode
store.set("example.com", null);    // clear → back to automatic detection
```

The extension header toggle should call `store.set(domain, mode)` and persist the
choice per domain (roadmap requirement). The store is storage-agnostic, so the
extension can inject `chrome.storage.local` instead of `localStorage`.

## Tests

`tests/universal-mode.test.ts` (Vitest) covers detection triggers, the override
precedence, every universal pillar, hotel-mode additivity, the strict schema, and
the HTML snapshot fallback:

```bash
npx vitest run tests/universal-mode.test.ts
```

## Remaining Phase 1 items

- Extension header **UI toggle** wired to `mode-override.ts`.
- Feeding live `renderedWidth`/`renderedHeight` measurements from the DOM extractor
  into `PageSnapshot` so the oversizing rule has real data.
- Persisting audit runs to the backend `runs` store.
