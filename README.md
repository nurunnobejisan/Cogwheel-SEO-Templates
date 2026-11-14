# Cogwheel SEO & GEO Visibility Studio

[![Latest Release](https://img.shields.io/github/v/release/jisan-razibmarketing/Cogwheel-SEO-Templates?style=flat-square&color=blue)](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates/releases/latest)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Production%20Live-000000?style=flat-square&logo=vercel&logoColor=white)](https://cogwheel-seo-templates.vercel.app)
[![Hotels Trained](https://img.shields.io/badge/Portfolio%20Trained-311%20Properties-success?style=flat-square)](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates)
[![License](https://img.shields.io/badge/Client-Razib%20Marketing-blue?style=flat-square)](https://razibmarketing.com)

An automated intelligence and optimization studio engineered specifically for luxury, boutique, and branded hospitality portfolios (Marriott Bonvoy, Hilton Honors, World of Hyatt, IHG One Rewards, and independent management collections).

The platform bridges traditional Organic Search Engine Optimization (SEO) and modern Generative Engine Optimization (GEO), automating 78-keyword pool allocation, PowerPoint client visibility reporting with zero leftover metadata, multi-platform AI citation audits, and executive stakeholder deliverables.

* **Production URL**: [cogwheel-seo-templates.vercel.app](https://cogwheel-seo-templates.vercel.app)
* **GitHub Repository**: [github.com/jisan-razibmarketing/Cogwheel-SEO-Templates](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates)

---

## Executive Overview

Hospitality digital marketing teams face two concurrent challenges: securing visibility in legacy search engines while defending brand authority in generative AI discovery engines where travelers increasingly plan trips. 

Cogwheel SEO Studio addresses both frontiers in an integrated workflow:

```
[Target Hotel URL / Semrush Workbook]
                   │
                   ▼
  ┌─────────────────────────────────────────────────────────┐
  │              Cogwheel Hospitality Core Engine           │
  ├────────────────────────────┬────────────────────────────┤
  │ Traditional Search (SEO)   │ Generative Engine (GEO)    │
  ├────────────────────────────┼────────────────────────────┤
  │ * 78-Keyword Pool Matrix   │ * 5 AI Search Engines      │
  │ * Comp-Set Share of Voice  │ * Structured Schema Audit  │
  │ * Ancillary Service Tagger │ * VisibilitySuite Sync     │
  │ * PowerPoint XML Scrubber  │ * Traveler Query Simulator │
  └────────────────────────────┴────────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 Executive Deliverables                  │
  ├─────────────────────────────────────────────────────────┤
  │ * Clean 16:9 Monthly Client Visibility PowerPoint Deck │
  │ * 1-Page Printable Executive Memo for Owners & GMs      │
  │ * 1-Click Client Briefing Email Dispatcher (Gmail)      │
  │ * Grounded Google Docs Strategy Recommendations         │
  └─────────────────────────────────────────────────────────┘
```

---

## Core Platform Capabilities

### 1. AI & GEO Readiness Radar (5-Platform Engine Audit)
* **Source Component**: `src/components/GeoReadinessRadar.tsx`
* **Coverage Scope**: Benchmarks citation likelihood and direct booking prominence across 5 major generative search engines:
  1. **ChatGPT Search** (OpenAI)
  2. **Google AI Overviews** (Search Generative Experience)
  3. **Google Gemini**
  4. **Perplexity AI**
  5. **Microsoft Copilot / Bing Generative**
* **5 Structured Schema Pillars**:
  * `Hotel / LodgingBusiness`: Validates primary NAP, geo-coordinates, check-in/out policies, and telephone routing.
  * `Restaurant / Dining`: Audits on-site culinary outlets, opening hours, menus, and cuisine categorization.
  * `DaySpa & Wellness`: Evaluates treatment lists, spa booking URLs, and wellness operating hours.
  * `Pets Allowed / Pet Policy`: Checks machine-readable fee structures, weight restrictions, and dedicated amenities.
  * `AmenityFeature`: Analyzes structured amenities (valet parking, resort pools, EV charging, meeting spaces).
* **Conversational Query Simulation**: Evaluates hotel recommendation accuracy against real traveler inquiries (e.g., *"Boutique hotel with river view and full-service spa in Florence AL"*).

### 2. VisibilitySuite.ai Integration & Data Connector
* **Source Component**: `src/components/VisibilitySuiteModal.tsx` | **Endpoint**: `/api/visibility-suite`
* **Automated Batch Export**: Generates compliant JSON and CSV schemas for VisibilitySuite onboarding endpoints (`/onboarding/prompts/batch` and `/onboarding/competitors`).
* **Direct REST API Sync**: Securely pushes property keywords, local comp-sets, and monitor intervals via Bearer token authentication.
* **Citation Calibration**: Ingests historical citation scores from VisibilitySuite to calibrate local GEO radar benchmarks.

### 3. Automated Monthly Visibility PowerPoint Engine
* **Source Engine**: `api/seo_visibility_report.py` | **Route**: `/api/seo-visibility-report`
* **OpenXML Comment Scrubber (`strip_pptx_comments`)**: Programmatically strips slide notes, comment pins, authors, and relation XML so exported PowerPoint files arrive completely free of internal review markers or leftover feedback bubbles.
* **Smart Service Matching**: Scans target hotel domains alongside keyword data to verify amenities (*Hotel & Lodging*, *Resort & Getaways*, *Spa & Wellness*), filtering irrelevant terms from the Ancillary Keyword table.
* **Multi-Format Ingestion**: Ingests baseline `.pptx` presentation templates, Semrush workbooks (`.xlsx`/`.xls`), and Google Search Console performance extracts.

### 4. Interactive In-Browser 16:9 Presentation Canvas
* **Source Component**: `src/components/SlideDeckPreview.tsx`
* **Real-Time Presentation Inspector**: Renders generated slides in true 16:9 aspect ratio directly within the browser interface.
* **Inline Executive Editing**: Allows marketing managers to adjust Top 10 rank counts, delta percentages, and the executive insight narrative directly on the slide surface prior to export.
* **Standard Deck Structure**:
  * **Slide 1**: Title cover with brand identity, property name, and reporting timeframe.
  * **Slide 2**: Tracked Rankings Matrix, Core KPIs, and Executive Narrative.
  * **Slide 3**: Ancillary Keyword Summary with verified service tags.
  * **Slide 4**: Strategic Rationale & Keyword Allocation Overview.
  * **Slide 5**: Technical SEO Status, Core Web Vitals, and 30-Day Priorities.

### 5. Local Comp-Set Ranking Matrix & Share of Voice (SOV)
* **Source Component**: `src/components/CompsetRankingMatrix.tsx`
* **Direct Market Benchmarking**: Evaluates your target hotel against top 3 regional competitors across high-value hospitality keywords.
* **Battleground Rank Tracking**: Renders organic rank positions, search volumes, and competitive advantage badges (`Leading (+X)`, `Tied`, `Behind (-X)`).
* **Share of Voice Metric**: Computes market share percentage across top 3 search placements in the property's primary destination tier.

### 6. Single-Page Executive Memo for Hotel Owners & GMs
* **Source Component**: `src/components/ExecutiveMemoModal.tsx`
* **Leadership-Oriented Layout**: Formatted for General Managers, owners, and asset management committees who need a 60-second operational summary.
* **Print-Ready CSS Architecture**: Strictly formatted with `@media print` rules for browser PDF generation (`window.print()`).
* **Executive Memo Sections**:
  * 4 Core Metric Badges (Top 10 Rankings, Local Share of Voice, Direct Booking Lift, GEO Readiness Score).
  * Top 5 Organic Search Wins with search volumes and ranking gain indicators.
  * Competitive Positioning Summary against primary comp-set.
  * 30-Day High-Impact Revenue & Technical Priorities.

### 7. Connected Client Email Dispatcher
* **Source Component**: `src/components/ClientEmailDispatcher.tsx` | **Endpoint**: `/api/client-email`
* **Gmail API Integration**: Connects with authorized Google accounts to streamline client deliverable communications.
* **Dispatch Actions**:
  * **Save Draft in Gmail**: Generates formatted deliverable summaries directly into your Gmail drafts folder.
  * **Send Email via Gmail**: Secure 1-click dispatch with pre-send verification.
  * **Open in Gmail Web**: Instant web compose deep link pre-filled with subject and client-ready body.
  * **Copy to Clipboard**: Quick copy for communication channels like Slack or CRM entries.

### 8. Pre-Trained Hospitality Knowledge Base (311 Hotels)
* **Data Store**: `src/data/trained-properties.json` | **Training Rules**: `src/core/training.ts`
* **Comprehensive Portfolio Coverage**: Over 310 pre-trained property profiles spanning:
  * Marriott Bonvoy (The Ritz-Carlton, JW Marriott, Autograph Collection, Renaissance, Westin, Courtyard)
  * Hilton Honors (Waldorf Astoria, Conrad, Curio Collection, DoubleTree, Hilton Garden Inn)
  * World of Hyatt (Park Hyatt, Andaz, Hyatt Centric, Hyatt Regency)
  * IHG One Rewards (InterContinental, Kimpton, Hotel Indigo)
  * Independent Luxury Portfolios (Sage Hospitality, HHM Groups 1/2/3, Bentley Legacy, HRI Lodging, PCH Hotels)
* **Property Auto-Fill**: Instant URL parsing that matches root domains to canonical names, locations, and comp-set configurations.

### 9. Automated 78-Keyword Allocation Engine
* **Endpoints**: `/api/ingest`, `/api/bucket`, `/api/select-kw`
* **Deduplication & Noise Scrubbing**: Automatically removes duplicate terms, normalizes character encoding, strips Byte Order Marks (BOM), and filters out wrong-state queries or low-intent noise (`Search Volume < 10`).
* **Algorithmic Page Mapping**: Allocates 78 high-yield keywords across home, accommodations, dining, meetings/events, amenities, and location pages based on topical authority.

### 10. Brand Flag Copywriting Studio (Hilton & Brand Compliance)
* **Endpoints**: `/api/generate-hc`, `src/core/hilton-validator.ts`
* **Diff-Marked Copy Generation**: Outputs exact additions (`**bold**`) and removals (`~~strikethrough~~`) for rapid stakeholder review.
* **Strict Guideline Compliance**: Automatically validates character limits, USP density, ADA terminology requirements, and JavaScript restrictions with automatic retry logic.

---

## System Architecture & Tech Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 14.2 (App Router), React 18 | High-performance server rendering and client interactive state |
| **Language** | TypeScript 5.5 | End-to-end type safety across components, models, and API routes |
| **Styling & Design** | Tailwind CSS 3.4, PostCSS, Lucide Icons | Responsive modern SaaS layout with system dark/light contrast |
| **Python Automation** | Python 3.10+, `python-pptx`, `openpyxl` | Low-level OpenXML PowerPoint and Excel data processing |
| **AI Inference** | Claude 3.5 Sonnet / Free Online AI (Pollinations) | Hospitality rationale generation and copy optimization |
| **External APIs** | VisibilitySuite.ai, Gmail API, Semrush API | Search intelligence and client communication delivery |
| **Testing Suite** | Vitest, Testing Library, TypeScript Compiler | Unit and regression test execution |
| **Hosting & CI/CD** | Vercel Serverless Platform, GitHub Actions | Zero-downtime production deployment and git auto-sync |

---

## API Reference

| Endpoint | Method | Payload / Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/api/seo-visibility-report` | `POST` | Multipart Form (`pptx`, `semrush`, `propertyUrl`) | Cleans PPTX OpenXML comments, maps services, and builds visibility presentation |
| `/api/visibility-suite` | `POST` | `{ action, property, keywords, competitors }` | Exports batch payloads, syncs with VisibilitySuite REST API, and pulls scores |
| `/api/client-email` | `POST` | `{ action, to, subject, htmlBody, propertyName }` | Drafts or dispatches monthly client deliverables through connected Gmail |
| `/api/property-autofill` | `POST` | `{ url }` | Resolves canonical hotel name, brand flag, city, state, and known comp-sets |
| `/api/crawl-property` | `POST` | `{ url }` | Extracts page sitemaps, structured schema, meta descriptions, and amenities |
| `/api/ingest` | `POST` | Multi-File Form (`.csv`, `.xlsx`, `.tsv`, `.txt`) | Deduplicates keywords, cleans BOM, and removes low-volume search terms |
| `/api/bucket` | `POST` | `{ keywords, propertyType }` | Groups keywords into thematic topic buckets based on hospitality intent |
| `/api/select-kw` | `POST` | `{ buckets, pages, targetCount: 78 }` | Selects and maps optimal 78-keyword pool across property sitemap |
| `/api/generate-kr` | `POST` | `{ property, selectedKeywords, templateId }` | Clones Google Doc template and populates grounded strategy recommendations |
| `/api/generate-hc` | `POST` | `{ property, copyType, sourceText }` | Generates character-constrained, ADA-compliant Hilton brand copy with diffs |
| `/api/ai-training` | `GET/POST`| `{ action, rule, propertyData }` | Ingests new portfolio rules and manages training guidelines |
| `/api/runs` | `GET/POST`| `{ runId, filter, propertyId }` | Stores and retrieves historical task runs, audit logs, and flag summaries |

---

## Repository Directory Structure

```
Cogwheel-SEO-Templates/
├── api/                             # Python automation scripts
│   └── seo_visibility_report.py     # OpenXML PowerPoint generation & comment scrubber
├── src/
│   ├── app/                         # Next.js 14 App Router
│   │   ├── api/                     # Serverless API routes (TypeScript)
│   │   │   ├── client-email/
│   │   │   ├── crawl-property/
│   │   │   ├── property-autofill/
│   │   │   ├── seo-visibility-report/
│   │   │   └── visibility-suite/
│   │   ├── globals.css              # Tailwind and custom UI styles
│   │   ├── layout.tsx               # Root application layout
│   │   └── page.tsx                 # Primary studio entrypoint
│   ├── components/                  # Enterprise React components
│   │   ├── CompsetRankingMatrix.tsx # Competitor battleground & SOV calculator
│   │   ├── ExecutiveMemoModal.tsx   # 1-page print-ready leadership memo
│   │   ├── GeoReadinessRadar.tsx    # 5-engine AI search readiness audit
│   │   ├── PropertyDashboard.tsx    # Master navigation and property selector
│   │   ├── SlideDeckPreview.tsx     # In-browser 16:9 interactive presentation canvas
│   │   └── VisibilitySuiteModal.tsx # VisibilitySuite.ai batch export & API sync
│   ├── core/                        # Business logic, validators & training
│   │   ├── hilton-validator.ts      # Hilton character and guideline validator
│   │   └── training.ts              # GEO and hospitality strategy rules
│   └── data/                        # Static datasets & knowledge base
│       └── trained-properties.json  # 311 pre-trained hotel property profiles
├── scripts/                         # Operational and auto-push tooling
│   └── auto-push.sh                 # Background git synchronization script
├── package.json                     # Node.js dependencies and script definitions
├── tailwind.config.ts               # Custom color palette and layout tokens
├── tsconfig.json                    # Strict TypeScript compiler options
└── vercel.json                      # Vercel serverless function memory and routing
```

---

## Getting Started

### Prerequisites

* **Node.js**: v18.17.0 or higher (v20.x recommended)
* **Python**: v3.10 or higher (with `python-pptx` and `openpyxl` installed)
* **Package Manager**: `npm` v9 or higher

### Local Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates.git
   cd Cogwheel-SEO-Templates
   ```

2. **Install Node Dependencies**:
   ```bash
   npm install
   ```

3. **Install Python Dependencies**:
   ```bash
   pip3 install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env.local
   ```

5. **Launch Development Server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Configuration

Configuration variables are managed in `.env.local`. Reference `.env.example` for default keys:

| Variable | Requirement | Purpose |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | Optional | Claude 3.5 Sonnet API key for generating recommendations and copy |
| `ENABLE_FREE_ONLINE_AI` | Optional | Set to `true` to enable zero-cost AI fallback when no API key is provided |
| `GOOGLE_SERVICE_ACCOUNT_B64` | Optional | Base64-encoded Google Service Account JSON for Google Docs & Drive |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID`| Optional | Root Drive folder ID for exported Google Docs |
| `GOOGLE_TEMPLATE_DOC_ID_A`   | Optional | Primary Keyword Recommendation template document ID |
| `GOOGLE_HILTON_TEMPLATE_DOC_ID`| Optional| Template ID for formatted Hilton copywriting documents |
| `SEMRUSH_API_KEY`            | Optional | Semrush API token for real-time keyword pulls |
| `SUPABASE_URL`               | Optional | Supabase instance URL for cross-session run persistence |
| `SUPABASE_SERVICE_ROLE_KEY`  | Optional | Supabase service key for backend database queries |

---

## Quality Assurance & Verification

The codebase maintains strict verification standards prior to every production release:

```bash
# Verify TypeScript types across all components and API routes
npm run typecheck

# Run ESLint static code analysis
npm run lint

# Execute automated test suite with Vitest
npm test

# Build production bundle for Next.js
npm run build
```

---

## Production Deployment

This project is configured for continuous production deployment on Vercel:

* **Production URL**: [https://cogwheel-seo-templates.vercel.app](https://cogwheel-seo-templates.vercel.app)
* **Deployment Trigger**: Pushes to branch `main` automatically trigger production builds.
* **Manual Deployment via CLI**:
  ```bash
  npx vercel --prod
  ```

---

## Enterprise Support & Maintenance

**Developed for Razib Marketing**  
Specialized Digital Marketing, SEO Intelligence, and Generative Engine Optimization for Luxury and Independent Hospitality Brands.

For support, custom hotel property integrations, or workflow additions:
* **Web**: [razibmarketing.com](https://razibmarketing.com)
* **Repository**: [jisan-razibmarketing/Cogwheel-SEO-Templates](https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates)
