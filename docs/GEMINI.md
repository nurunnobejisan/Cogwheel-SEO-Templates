# SEO & GEO Studio — Engineering & Standards Rules (GEMINI.md)

This document establishes the mandatory architectural, SEO, markup, and validation rules for **SEO & GEO Studio**. All code, components, and routes authored in this workspace must strictly adhere to these standards.

---

## 1. Strict Semantic HTML5 Architecture

Every page and major layout MUST be constructed with explicit semantic HTML5 landmarks. Anonymous `div` wrappers must never be used in place of standard semantic structural elements:

| Element | Mandated Usage | Verification Requirement |
|---|---|---|
| `<header>` | Top-level branding, site identity, and primary header elements on every page and major section. | Must exist at top of layout and within major article blocks. |
| `<nav>` | Navigation blocks, breadcrumb trails, tab switchers, and pagination links. | Must be labeled with accessible `aria-label` when multiple nav blocks exist. |
| `<main>` | The single primary content container per route. Never wrap within another landmark. | Exactly one `<main>` landmark per rendered page view. |
| `<article>` | Independent, self-contained units of content (e.g., templates, audit reports, cards, documentation sections). | Used for distinct template previews, audit findings, and guides. |
| `<aside>` | Ancillary or contextual information (e.g., quick property selectors, filter controls, action sidebars). | Positioned for contextual support without polluting the main reading flow. |
| `<footer>` | Page-level and site-wide footers containing copyright, metadata, disclaimers, and auxiliary navigation. | Present on every route layout. |

### Anti-Pattern Example (Disallowed)
```html
<!-- ❌ DISALLOWED: Anonymous div container soup -->
<div class="top-bar">...</div>
<div class="content-wrapper">
  <div class="left-col">...</div>
  <div class="right-col">...</div>
</div>
<div class="bottom-bar">...</div>
```

### Compliant Pattern (Mandatory)
```html
<!-- ✅ MANDATORY: Explicit Semantic HTML5 Landmarks -->
<header class="site-header">
  <nav aria-label="Primary Navigation">...</nav>
</header>
<main class="site-main">
  <article class="primary-content">...</article>
  <aside class="contextual-sidebar">...</aside>
</main>
<footer class="site-footer">...</footer>
```

---

## 2. Zero Broken Links Policy

- Every internal route reference (`<Link href="...">` or `<a href="...">`) must resolve to a valid, existing route (e.g. `/`, `/templates`, `/strategy-matrix`, `/architecture`).
- Every in-page hash anchor (e.g., `#onpage`, `#schema`) must map to an element with a matching `id`.
- Asset URLs (`/nurunnobe-logo.png`, `/cogwheel-seo-studio.zip`, `/docs/assets/system-architecture.svg`) must exist in `public/` or `docs/assets/`.
- External URLs must point to valid canonical origins with `rel="noopener noreferrer"` and `target="_blank"`.
- Run automated link verification before every release: zero 404s allowed.

---

## 3. Strict Character-Budgeted Metadata

Every route must define unique, bespoke metadata strictly adhering to physical search snippet bounds:

| Metric | Target Bounds | Enforcement Criteria |
|---|---|---|
| **Meta Title (`title`)** | **50 – 60 characters** | - Exact character length enforced by automated tests.<br>- Must include primary entity + brand suffix.<br>- No truncation on 580px Google SERP Arial 20px desktop viewport. |
| **Meta Description (`description`)** | **145 – 155 characters** | - Exact character length enforced by automated tests.<br>- Must provide compelling summary and clear action trigger.<br>- No truncation on 920px Google SERP Arial 14px desktop viewport. |
| **OpenGraph (`og:title`, `og:description`)** | Mirrored | Matches title and description with high-resolution 1200x630 OG image. |
| **Canonical URL** | Absolute link | Every page must specify its canonical URL to prevent duplication. |

### Route Metadata Registry
- **`/` (Dashboard)**:
  - Title: `SEO & GEO Audit Studio — Hotel Search Engine Suite` (53 chars)
  - Description: `Automated hospitality search and generative engine optimization suite with physical pixel budgeting, brand guardrails, and client-ready reporting.` (147 chars)
- **`/templates` (Template Catalog)**:
  - Title: `Hospitality SEO & GEO Templates — SEO Studio Platform` (53 chars)
  - Description: `Production-ready on-page, lodging schema, GEO AI visibility, and GBP UNAP audit templates tailored for Marriott, Hilton, IHG, Hyatt, and luxury hotels.` (151 chars)
- **`/strategy-matrix` (78-Keyword Matrix)**:
  - Title: `78-Keyword Hospitality Strategy Matrix — SEO Studio Suite` (56 chars)
  - Description: `Comprehensive 78-keyword strategy matrix for hotel SEO across Brand, Local, Airport, Meetings, Extended Stay, and Generative AI conversational queries.` (151 chars)
- **`/architecture` (System Architecture)**:
  - Title: `System Architecture & Technical Specs — SEO Studio Suite` (55 chars)
  - Description: `Complete technical architecture for Manifest V3 extension, AI training data vault, hybrid model inference routing, and Python fine-tuning pipelines.` (150 chars)

---

## 4. Mobile-First Responsive Tailwind CSS

- All layouts must be authored mobile-first: baseline styles target `< 640px` viewports, progressively enhanced using `sm:`, `md:`, `lg:`, `xl:`, and `2xl:` breakpoints.
- Zero horizontal overflow (`overflow-x: hidden` safety bounds, container padding, flexible wraps).
- High-contrast color palette supporting both Light Mode and Dark Mode (`dark:` variants).
- Minimum tap targets: interactive elements must have at least 44x44px touch boundaries or `py-2 px-3` minimum padding.
- Tabular numerals (`tabular-nums`) for scores, pixel metrics, word counts, and financial values.

---

## 5. Automatic Browser Verification After Every Change

After any code change affecting routes, layouts, or UI components:
1. **Dev Server Launch**: Ensure local development or production server is active on `localhost:3000`.
2. **Chrome Browser Inspection**: Use the Antigravity Chrome Extension / DevTools browser subagent to navigate to all modified URLs.
3. **Zero Console Errors**: Assert that `console.error()`, unhandled promise rejections, and 404 network warnings are strictly zero.
4. **Visual Artifact Capture**: Save a full-page or viewport screenshot artifact in `<appDataDir>/brain/<conversation-id>/` for audit verification.

---

## 6. Pre-Commit Verification Checklist

Before pushing any commit:
- [ ] `npm run typecheck` passes with zero TypeScript errors.
- [ ] `npm test` passes 100% of Vitest suites.
- [ ] `python3 tests/python/run_tests.py` passes all 16 Python tests.
- [ ] `python3 python/scripts/validate_schemas.py` verifies SSOT contracts.
- [ ] `npm run build` generates all static routes with zero build warnings.
- [ ] All routes validated for semantic HTML5 landmarks and metadata length bounds.
