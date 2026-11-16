# Cogwheel SEO Templates — Comprehensive File Inventory

This inventory documents all architectural assets across the 10-day engineering upgrade.

## 1. Directory Structure Standard
The standardized production architecture organizes modular components under:
- `/templates`: Reusable SEO templates (HTML, Liquid, Blade/PHP, Webflow) and template definitions
- `/schemas`: Composable JSON-LD schema generators (Article, Product, FAQPage, LocalBusiness, BreadcrumbList, GraphBuilder)
- `/validators`: Core SEO quality gates (variableResolver, xssProtection, canonicalNormalizer, robotsGuardrails, serpOptimizer, uniquenessGate, internalLinker)
- `/exporters`: Multi-CMS format exporters (HTML, Shopify Liquid, WordPress PHP/Yoast, Webflow CSV)
- `/tests`: Automated unit and integration regression test suite
- `/src/components`: UI components including Studio, PropertyDashboard, and Labs
- `/src/tasks`: Task-based workflows and contracts

## 2. File Status Matrix

| Path | Category | Status | Description |
|---|---|---|---|
| `.env.example` | Config | Updated | Documented environment variable specifications |
| `.gitignore` | Config | Updated | Strict rules preventing leaks of secrets and build artifacts |
| `INVENTORY.md` | Docs | Created | Complete repository file inventory |
| `validators/variableResolver.ts` | Validator | Created | Strict placeholder resolver, fallback engine & pre/post scans |
| `validators/xssProtection.ts` | Validator | Created | Context-aware HTML body and attribute escaper |
| `validators/canonicalNormalizer.ts` | Validator | Created | Protocol enforcer, tracking stripper, slash normalizer |
| `validators/robotsGuardrails.ts` | Validator | Created | Environment-aware robots directives & prod noindex blocker |
| `schemas/article.ts` | Schema | Created | Schema.org Article structured data builder |
| `schemas/product.ts` | Schema | Created | Schema.org Product with Offer and AggregateRating |
| `schemas/faqPage.ts` | Schema | Created | Schema.org FAQPage structured data builder |
| `schemas/localBusiness.ts` | Schema | Created | Schema.org LocalBusiness/LodgingBusiness builder |
| `schemas/breadcrumbList.ts` | Schema | Created | Schema.org BreadcrumbList navigation builder |
| `schemas/graphBuilder.ts` | Schema | Created | Unified @graph composable schema builder |
| `validators/serpOptimizer.ts` | Validator | Created | Pixel-width character analyzer, title trimmer & SERP warnings |
| `validators/uniquenessGate.ts` | Validator | Created | N-gram & Jaccard similarity analyzer & thin-content gate |
| `validators/internalLinker.ts` | Validator | Created | Semantic topic clustering & automated internal linking engine |
| `exporters/htmlExporter.ts` | Exporter | Created | Clean HTML5 generator with metadata and minification |
| `exporters/shopifyExporter.ts` | Exporter | Created | Shopify Liquid snippet and section generator |
| `exporters/wordPressExporter.ts` | Exporter | Created | WordPress PHP template partials and Yoast/RankMath mapper |
| `exporters/webflowExporter.ts` | Exporter | Created | Webflow CMS collection CSV and rich-text exporter |
| `tests/variableResolver.test.ts` | Test | Created | Tests for missing vars, unresolved tokens, and fallbacks |
| `tests/securityGuardrails.test.ts` | Test | Created | Tests for XSS escaping, canonical URLs, and robots tags |
| `tests/schemas.test.ts` | Test | Created | Tests for all 5 JSON-LD schemas and @graph composition |
| `tests/serpOptimizer.test.ts` | Test | Created | Tests for pixel calculations, title trimmers, and warnings |
| `tests/uniquenessGate.test.ts` | Test | Created | Tests for Jaccard similarity and thin content thresholds |
| `tests/internalLinker.test.ts` | Test | Created | Tests for topic relevance and internal linking rules |
| `tests/exporters.test.ts` | Test | Created | Tests for all 4 CMS export adapters |
| `tests/seoLinter.ts` | Tool/Test | Created | Master SEO integrity validator (runs on `npm run lint:seo`) |
| `.github/workflows/seo-integrity.yml` | CI/CD | Created | GitHub Actions pipeline running secret scan & SEO linter |
| `templates/hotel-destination-guide.html`| Template | Created | Production sample template for hotel destinations |
| `templates/hotel-room-showcase.html` | Template | Created | Production sample template for room showcase pages |
| `templates/hotel-faq-amenities.html` | Template | Created | Production sample template for hotel amenities & FAQ |
| `src/components/PropertyDashboard.tsx` | UI | Updated | Labs experimental hub, luxury visual polish, pipeline telemetry |
| `src/components/LabsView.tsx` | UI | Updated | 8-Tool Suite: Multi-CMS Exporters, Duplicate Scanner, Canonical Normalizer, GEO AI & SERP |
| `tests/ts/edge-cases-and-defenses.test.ts` | Test | Created | Defensive unit tests covering regex leaks, quote sanitization & fallbacks |
| `docs/ARCHITECTURE.md` | Docs | Created | System architecture and directory guide |
| `docs/reports/TYPESCRIPT_CI_FIX_REPORT.md` | Docs | Created | CI failure investigation and repair report |
| `README.md` | Docs | Updated | Comprehensive system documentation (v2.6.0) |
