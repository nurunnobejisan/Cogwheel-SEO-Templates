# Cogwheel SEO & Hospitality Templates Studio
> Production-grade, spec-driven SEO and Generative Engine Optimization (GEO) platform for independent and enterprise hotel properties by **Razib Marketing**.

[![SEO Integrity & Security CI](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/actions/workflows/seo-integrity.yml/badge.svg)](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/actions)
[![Release v2.6.0](https://img.shields.io/badge/Release-v2.6.0-a3d11b?style=flat-square&logo=github)](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/releases/tag/v2.6.0)
[![Next.js 14.2](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript 5.5](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js v22](https://img.shields.io/badge/Node.js-v22-green?style=flat-square&logo=node.js)](https://nodejs.org/)

---

## 1. Project Overview & Architecture

Cogwheel SEO Studio automates end-to-end technical SEO, metadata generation, structured data composition, internal linking, and multi-CMS exports for hotel portfolios. It provides strict validation gates ensuring no uncompiled placeholders, XSS vulnerabilities, thin content, duplicate content, or production `noindex` directives ever reach live deployments.

### Standardized Folder Architecture
```
Cogwheel-SEO-Templates/
├── templates/                     # Production templates & sample data
│   ├── hotel-destination-guide.html
│   ├── hotel-room-showcase.html
│   ├── hotel-faq-amenities.html
│   └── sample-data.json
├── schemas/                       # Composable JSON-LD @graph Builders
│   ├── article.ts                 # Schema.org Article
│   ├── product.ts                 # Schema.org Product (Offer + AggregateRating)
│   ├── faqPage.ts                 # Schema.org FAQPage (Question + Answer)
│   ├── localBusiness.ts           # Schema.org Hotel / LodgingBusiness
│   ├── breadcrumbList.ts          # Schema.org BreadcrumbList
│   ├── graphBuilder.ts            # Unified @graph composer
│   └── index.ts
├── validators/                    # Core Quality & Security Gates
│   ├── variableResolver.ts        # Strict template compiler, fallbacks & leak scanner
│   ├── xssProtection.ts           # Context-aware HTML & attribute sanitization
│   ├── canonicalNormalizer.ts     # Protocol enforcer, query cleaner & slash normalizer
│   ├── robotsGuardrails.ts        # Env-aware robots & production noindex blocker
│   ├── serpOptimizer.ts           # Typography character width lookup & title trimmer
│   ├── uniquenessGate.ts          # N-gram & Jaccard similarity scorer (>70% duplicate block)
│   └── internalLinker.ts          # Manifest-driven semantic contextual linker
├── exporters/                     # Multi-CMS Export Adapters
│   ├── htmlExporter.ts            # Clean HTML5 with metadata & minification
│   ├── shopifyExporter.ts         # Shopify Liquid snippets (.liquid) & sections
│   ├── wordPressExporter.ts       # WordPress PHP partials & Yoast/RankMath mapper
│   ├── webflowExporter.ts         # Webflow Collection CSV & rich-text exporter
│   └── index.ts
├── tests/                         # Automated Regression & Linter Suite
│   ├── variableResolver.test.ts
│   ├── securityGuardrails.test.ts
│   ├── schemas.test.ts
│   ├── serpOptimizer.test.ts
│   ├── uniquenessGate.test.ts
│   ├── internalLinker.test.ts
│   ├── exporters.test.ts
│   └── seoLinter.ts               # Master 10-Gate SEO Quality Checker
├── scripts/                       # DevOps & CLI Tooling
│   ├── seo-preview-cli.ts         # Local interactive marketing previewer
│   └── pre-commit.sh              # Lightweight git pre-commit hook
├── src/                           # Next.js 14 Web Application
│   ├── app/                       # App Router pages and API routes
│   ├── components/                # React components (PropertyDashboard, Studio, Labs)
│   ├── core/                      # Hilton guidelines & training rules
│   └── data/                      # 311+ pre-trained hotel property profiles
├── .github/workflows/             # Continuous Integration Pipelines
│   └── seo-integrity.yml          # GitHub Actions automated linter & secret scanner
├── .env.example                   # Exhaustive environment variable specification
├── INVENTORY.md                   # Full repository file catalog
└── package.json                   # Script definitions and dependencies
```

---

## 2. Installation & Quick Start

### Prerequisites
- Node.js 20+ or 22+
- NPM 10+

### Setup
```bash
# 1. Clone the repository
git clone https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates.git
cd Cogwheel-SEO-Templates

# 2. Copy and configure environment variables
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Start Next.js Development Server
npm run dev
```

---

## 3. SEO Quality & Integrity Commands

The repository provides automated CLI tools for testing, linting, and previewing SEO templates:

| Command | Description |
|---|---|
| `npm run lint:seo` | **Master 10-Gate SEO Linter** — validates variables, XSS, robots, canonicals, schemas, SERP widths, uniqueness, internal links, and CMS exporters. Exits with code 1 on failure. |
| `npm run preview:seo` | **Interactive Marketing Previewer** — compiles templates with sample data, generates Desktop/Mobile Google SERP previews, inspects JSON-LD, and generates all 4 CMS formats. |
| `npm test` | Runs the Vitest automated test suite. |

To run the complete automated test suite across all 10 milestones:
```bash
node --test --experimental-strip-types tests/*.test.ts
```

---

## 4. The 10-Day Engineering Architecture

### Day 1 — Secret Cleanup & Standardized Architecture
- Zero hardcoded API keys or credentials.
- Multi-tier `.gitignore` preventing accidental commits of keys, `.env*`, and build caches.
- Standardized top-level `/templates`, `/schemas`, `/validators`, `/exporters`, `/tests` directories.

### Day 2 — Strict Variable Resolver & Fallback Engine (`/validators/variableResolver.ts`)
- Pre-render schema validation enforcing required vs optional variables.
- Multi-syntax placeholder replacement (`{{var}}`, `{var}`, `${var}`).
- Post-render regex scan detecting and blocking any leaking placeholders (`{{raw}}`, `undefined`, `null`, `NaN`).

### Day 3 — XSS Protection & Robots Guardrails (`/validators/`)
- Context-aware HTML entity escaping and attribute sanitization (`xssProtection.ts`).
- Canonical URL Normalizer (`canonicalNormalizer.ts`) enforcing HTTPS, stripping marketing parameters (`utm_*`, `fbclid`, `gclid`), and normalizing slashes.
- Production Noindex Blocker (`robotsGuardrails.ts`) preventing catastrophic organic traffic loss by failing builds if `noindex` is detected in production.

### Day 4 — Composable JSON-LD @graph Builder (`/schemas/`)
- Modular Schema.org builders: `Article`, `Product` (with Offer & AggregateRating), `FAQPage`, `LocalBusiness` / `Hotel`, and `BreadcrumbList`.
- Unified `@graph` composer under a single `https://schema.org` `@context`.
- Prevents script tag breakout and escaped newline issues.

### Day 5 — SERP Pixel-Width Optimizer (`/validators/serpOptimizer.ts`)
- Character-width lookup based on Google's Arial typography (distinguishing wide characters like `W`, `M` from narrow `i`, `l`).
- Desktop Title limit: 580px max.
- Mobile Title limit: 920px max.
- Meta Description limits: 70 chars min, 155–160 chars recommended, 920px ceiling.
- Smart word-boundary title trimmer preserving core keyword phrases and peeling off brand suffixes.

### Day 6 — Anti-Thin-Content Gate & Uniqueness Scorer (`/validators/uniquenessGate.ts`)
- N-gram (tri-gram) tokenization and Jaccard similarity scoring across page batches.
- Blocks pages exceeding **70% duplicate similarity**.
- Enforces minimum non-boilerplate word count (**250 words** default).
- Conditional section validator preventing empty feature or comparison tables.

### Day 7 — Semantic Topic Clustering & Internal Linking (`/validators/internalLinker.ts`)
- Manifest-driven contextual link injection connecting Hub, Child, and Sibling pages.
- Guardrails:
  - Never links a page to itself.
  - Maximum 1 link per target URL per page.
  - Never injects inside `<h1>`-`<h6>` headings or existing `<a>` anchor tags.
  - Anchor text variation preventing over-optimization penalties.

### Day 8 — Multi-CMS Export Adapters (`/exporters/`)
- **HTML Exporter**: Clean HTML5 with canonicals, robots directives, JSON-LD, and optional minification.
- **Shopify Liquid Exporter**: Generates `.liquid` snippets and sections mapped to `product.*`, `collection.*`, and `page.*`.
- **WordPress Exporter**: Compatible PHP template partials and Yoast SEO / Rank Math custom field mappings.
- **Webflow Exporter**: RFC 4180-compliant CSV generation with clean rich-text HTML escaping.

### Day 9 — CI/CD Automation & Pre-Commit Guardrails
- GitHub Actions pipeline (`.github/workflows/seo-integrity.yml`) executing secret scanning and the 10-gate SEO linter on every push and pull request.
- Git pre-commit hook (`scripts/pre-commit.sh`) preventing bad commits locally.

### Day 10 — Interactive Preview Tool & Labs Integration
- Standalone CLI previewer (`scripts/seo-preview-cli.ts`) for marketing team members.
- Next.js UI integration with experimental **Labs** hub in `PropertyDashboard.tsx`.
- **Multi-CMS Exporter Playground**: Live side-by-side compilation and one-click code copy or file download for HTML5, Shopify Liquid, WordPress PHP, and Webflow CSV.
- **GEO AI Search Simulator**: Live emulation of citations and response summaries across Google Gemini Overviews, ChatGPT Search, and Perplexity Pro.
- **Rich SERP Snippet Preview**: Desktop & mobile SERP previews featuring Google hotel star ratings (`★★★★★`), localized pricing tags, and amenity pill badges.
- **Content Duplicate & Thin-Content Scanner**: Live Jaccard tri-gram similarity analysis comparing website copy against OTA channels (Expedia, Booking.com) to block duplicate penalty risks (&lt;70% ceiling).
- **Dirty URL & Canonical Normalizer**: Instant stripping of campaign/tracking parameters (`utm_*`, `gclid`, `fbclid`), trailing slash normalization, and copyable `<link rel="canonical">` HTML tags.
- **Luxury Hospitality Visual Polish**: Dual-mode radial ambient glow, spring-curve card hover physics (`.card-hover`), and real-time pulsing workflow pipeline telemetry.

---

## 5. License & Attribution
Developed and maintained by **Razib Marketing** — Hospitality Digital Marketing & AI Search Optimization.
Protected under private commercial license.
