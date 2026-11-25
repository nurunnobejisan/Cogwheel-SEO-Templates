# Initial Product Audit — Cogwheel SEO & GEO Studio
**Date:** 2026-11-23  
**Auditor:** Principal Enterprise Systems & SEO Architect  
**Workspace:** `jisan-razibmarketing/Cogwheel-SEO-Templates`  
**Version Baseline:** 2.8.0  

---

## 1. Executive Summary

Cogwheel SEO & GEO Studio is a specialized hospitality search engine optimization and generative engine optimization (GEO) platform. Originally conceived for hotel property SEO audits with strict adherence to Hilton brand guidelines and physical pixel-budgeted SERP snippets, the application has evolved through multiple phases into a multi-vertical search automation engine.

This initial audit establishes the ground truth of the codebase across all tiers: UI components, API routes, task pipeline runners, data stores, database migrations, Python analytical modules, and Chrome extension capture systems.

### Key Audit Findings
1. **Strong Architectural Foundations**: The task pipeline (`src/core/pipeline.ts`), crawler engine (`src/core/crawler/`), and schema generators (`schemas/`) are cleanly architected, strictly typed, and resilient to missing external credentials via graceful in-memory fallbacks.
2. **Phase 1 vs. Phase 2/3 Feature Asymmetry**: Out of 22 registered tasks in `src/tasks/tasks.config.ts`, 11 tasks are implemented with full contract validation and pipeline execution. The remaining 11 tasks (primarily in Off-Page, Local SEO, Competitor Intelligence, and Advanced Executive Reporting) are registered as `Not started` and trigger `ComingSoonModal` in the frontend UI.
3. **Data Isolation & Multi-Tenancy**: While property data is stored cleanly (`properties`, `runs`, `run_keywords`, `task_runs`), there is no first-class `clients` table or organization tenant hierarchy. All properties currently exist in a single pool.
4. **Client-Side vs. Backend Disconnects**: Several UI modals (e.g., `ClientDeliverablesModal`, `AutoPilotModal`, `GeoReadinessRadar`) operate with mock or simulated state rather than executing end-to-end backend orchestration runs.
5. **Security & Guardrails**: Server-side SSRF validation and XSS escaping are implemented. However, Role-Based Access Control (RBAC) is not enforced at the API route level, and API keys are not centrally managed through a tenant settings vault.

---

## 2. Directory Structure Analysis

```
Cogwheel-SEO-Templates/
├── .github/workflows/          # CI/CD: ci.yml, seo-integrity.yml, auto-release.yml
├── AUDIT/                      # Architectural audits, inventory, and roadmaps
├── chrome-extension/           # Chrome MV3 TypeScript Extension (Vite + React)
│   ├── src/background/         # Tab routing, injection, alarms, sync
│   ├── src/content/            # Universal DOM extraction, CWV, tech stack
│   ├── src/engine/             # SFT dataset builder, validation
│   ├── src/storage/            # Training vault with IndexedDB and dedupe
│   └── src/components/         # Side panel audit, bulk automation, options
├── data/                       # Static matrices & configurations
│   ├── 78-keyword-strategy-matrix.json
│   └── ota-config.json
├── docs/                       # Architecture diagrams, specifications, assets
├── exporters/                  # Multi-CMS Export Adapters
│   ├── htmlExporter.ts         # Minified semantic HTML5
│   ├── shopifyExporter.ts      # Liquid template partials
│   ├── wordPressExporter.ts    # PHP partials with Yoast/RankMath meta
│   └── webflowExporter.ts      # Webflow CMS CSV & rich text
├── schemas/                    # JSON-LD Schema.org Builders & Schemas
│   ├── article.ts, product.ts, faqPage.ts, localBusiness.ts, breadcrumbList.ts
│   └── graphBuilder.ts         # Unified @graph composition
├── scripts/python/             # Python ML & Data Engineering Tooling
│   ├── fine_tune_pipeline.py   # Training data pipeline (Ruff & Mypy validated)
│   ├── content_engine.py       # Embeddings and text similarity analysis
│   └── validate_schemas.py     # SSOT contract validator
├── src/                        # Next.js Application Core
│   ├── app/                    # Next.js App Router routes & API endpoints
│   ├── components/             # React UI components (Dashboard, Labs, Studio)
│   ├── core/                   # Shared pipeline, crawler, Claude LLM, runs
│   ├── lib/                    # Supabase client, Google APIs, exporters
│   ├── tasks/                  # Task Registry (22 tasks) & Task Runners
│   └── validators/             # SEO Validators (SERP, Canonical, Robots, XSS)
├── supabase/migrations/        # SQL Schemas (0001_init, 0002_task_runs, etc.)
└── tests/                      # Automated Vitest & Python Test Suites (141+ tests)
```

---

## 3. Technology Stack & Runtime Verification

| Component | Technology | Version / Configuration | Verification Status |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | 14.2.23 | Production build passing |
| **Language** | TypeScript | 5.3.3 (Strict Mode) | Zero `tsc --noEmit` errors |
| **Styling** | Tailwind CSS | 3.4.1 (Mobile-first) | Compliant with dark/light mode |
| **Testing Engine** | Vitest | 2.1.8 | 141/141 tests passing |
| **Node.js Target** | Node.js | v20 LTS / v22 (CI) | Compatible via `tsx` runner |
| **Python Runtime** | Python | 3.11+ | Ruff & Mypy strict passing |
| **Database** | Supabase Postgres | PostgreSQL 15 | RLS enabled + In-memory fallback |
| **LLM Provider** | Anthropic Claude SDK | `@anthropic-ai/sdk` | Pinned `temperature: 0.2` |
| **Chrome Extension** | Manifest V3 | TypeScript / Vite | Universal DOM injection enabled |

---

## 4. Current State by Functional Area

### 4.1 On-Page SEO & Content Studio
- **Implemented**: `keyword-research`, `title-meta`, `heading-structure`, `usp-headline-optimization`, `image-optimization`, and `seo-baseline-ai-visibility`.
- **Strengths**: Strict Hilton brand guardrails, physical pixel SERP calculators (580px title / 920px description), exact character budgeting, and ADA compliance rules.
- **Gaps**: `compsets-keywords-analysis` and `keyword-ranking-report-comp-set` are missing execution logic.

### 4.2 Technical SEO & Crawling Engine
- **Implemented**: `site-crawl`, `technical-audit`, `duplicate-content-audit`, `schema-markup`.
- **Strengths**: Chunked batch queue crawling, SSRF protection against loopback/private ranges, Jina Reader fallback, robots.txt & XML sitemap parser.
- **Gaps**: `sitemap-navigation-optimization` and `site-tech-re-audit-report` are unbuilt.

### 4.3 Off-Page & Backlinks
- **Implemented**: None (all tasks registered as `Not started`).
- **Gaps**: Backlink ingestion (Semrush/Ahrefs CSV parser), referring domain analysis, link gap calculator, and outreach template generators need full implementation.

### 4.4 Local SEO & Google Business Profile
- **Implemented**: LocalBusiness/LodgingBusiness schema builders.
- **Gaps**: `google-map-citation` task unbuilt; NAP consistency auditing and local citation tracking need backend engine.

### 4.5 AI Search & GEO Intelligence
- **Implemented**: `GeoReadinessRadar` UI, `seo-baseline-ai-visibility` task, training capture extension.
- **Gaps**: Live prompt tracking across ChatGPT Search, Google AI Overviews, and Perplexity needs structured observation recording and transparent scoring.

### 4.6 Reporting & Multi-Format Exporters
- **Implemented**: `seo-only-visibility-report` (PPTX), CMS exporters (HTML, Shopify Liquid, WordPress PHP, Webflow CSV).
- **Gaps**: `ai-seo-visibility-report` and `final-seo-geo-project-report` are unbuilt; Executive Pitch Deck and Client Deliverables modals need direct pipeline generation.
