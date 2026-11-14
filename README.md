# Cogwheel SEO & GEO Visibility Studio — Razib Marketing

Automated hospitality SEO intelligence, 78-keyword pool allocation, PowerPoint monthly visibility reporting, Generative Engine Optimization (GEO) audit radar, and multi-channel client deliverable studio for independent and branded hotels.

---

## 🌟 Comprehensive Feature Suite

### 1. 🤖 AI & GEO (Generative Engine Optimization) Readiness Radar
* **Component**: `src/components/GeoReadinessRadar.tsx`
* **0–100% AI Citation Readiness Score**: Circular animated gauge benchmarking property visibility across modern AI engines (**ChatGPT Search**, **Google AI Overviews**, **Perplexity AI**, and **Bing/Copilot**).
* **Hospitality Schema Audit**: Scans and verifies 5 critical structured data pillars:
  * `Hotel / LodgingBusiness` schema (NAP, geo-coordinates, check-in/out hours).
  * `Restaurant / Dining` schema (menus, opening hours, cuisine types).
  * `DaySpa & Wellness` schema (treatment packages, service lists).
  * `Pets Allowed / Pet Policy` schema (explicit fees, pet amenities, weight limits).
  * `AmenityFeature` specifications (Wi-Fi, pool, EV charging, fitness center).
* **Conversational AI Query Generator**: Simulates authentic traveler prompts (e.g. *"Best boutique hotel with river view and spa in Florence AL"*), evaluating AI citation confidence and showing simulated model responses.

### 2. 📊 PowerPoint Monthly Visibility Deck Generator
* **Endpoint**: `/api/seo-visibility-report` | **Core Python Engine**: `api/seo_visibility_report.py`
* **Permanent XML Comment Stripping**: Built-in OpenXML comment scrubber (`strip_pptx_comments`) completely cleans slide notes, comment pins, authors, and relation XML so downloaded PowerPoint decks never show leftover feedback bubbles or comment sidebars.
* **Smart Service Matching**: Scans target hotel URL and Semrush keyword workbook to automatically detect and tag services (*Hotel & Lodging*, *Resort & Getaways*, *Spa & Wellness*), filtering out irrelevant noise from the Ancillary Keyword summary.
* **Multi-File Ingest**: Supports drag & drop for PowerPoint templates (`.pptx`), Semrush exports (`.xlsx`/`.xls`), and Google Search Console/SEM PDFs.

### 3. 🖥️ In-Browser Live Slide Deck Preview (Interactive Carousel)
* **Component**: `src/components/SlideDeckPreview.tsx`
* **Interactive 16:9 Presentation Canvas**: Inspect generated presentation slides directly in the browser before or after downloading.
* **Full Carousel Navigation**: Previous (`◀`), Next (`▶`), 1–5 slide jump pills, and bottom thumbnail strip.
* **Live Inline Editing**: Modify Top 10 rankings counts, improvement deltas, and the **Executive Insight callout** directly on the slide canvas with real-time updates.
* **Slide Sequence**:
  * **Slide 1**: Cover slide with Cogwheel branding, property title, and reporting window.
  * **Slide 2**: Tracked Rankings Table, KPI cards, and editable executive narrative.
  * **Slide 3**: Ancillary Keyword Position Summary with verified property service badges.
  * **Slide 4**: Why Track & Full Keyword Visibility rationale.
  * **Slide 5**: Technical SEO Health, Core Web Vitals, and priority action items.

### 4. 🏨 Local Comp-Set Ranking Matrix
* **Component**: `src/components/CompsetRankingMatrix.tsx`
* **Nearby Competitor Benchmarking**: Directly benchmarks your active property against the top 3 local competitors (e.g., *GunRunner Boutique Hotel*, *Courtyard Florence*, *Hampton Inn Downtown*).
* **Keyword Battleground Table**: Compares organic ranks, search volumes, and displays **Competitive Edge badges** (`▲ Leading (+2)`, `= Tied #1`, `▼ Behind (-3)`).
* **Share of Voice Calculation**: Computes the percentage of high-intent local search queries where your property commands top 3 organic rankings.
* **Custom Keyword Radar**: Add custom localized keywords on the fly.

### 5. 📄 1-Page Executive PDF Memo for Hotel Owners / GMs
* **Component**: `src/components/ExecutiveMemoModal.tsx`
* **Tailored for Leadership**: Concise, executive briefing designed for General Managers and asset managers who prefer a quick 1-page summary over 20-slide presentations.
* **Strict 1-Page Print Layout**: Formatted with print CSS (`@media print`) for clean printing and PDF export (`window.print()`).
* **Memo Sections**:
  * **4 Executive KPI Badges**: Top 10 Rankings, Local Share of Voice, Direct Booking Revenue Lift, AI & GEO Readiness Score.
  * **Top 5 Organic Search Wins**: Ranked primary terms with gain arrows and monthly search volumes.
  * **Local Comp-Set Positioning**: High-level market share briefing.
  * **30-Day Technical & Revenue Action Items**: High-priority recommendations with clear business rationales.

### 6. ✉️ 1-Click Client Email Dispatcher
* **Component**: `src/components/ClientEmailDispatcher.tsx`
* **Endpoint**: `/api/client-email`
* **Connected Gmail Integration**: Generates executive monthly email deliverable briefings using your connected Google account (`riboynjsr@gmail.com`).
* **One-Click Actions**:
  * **Save Draft in Gmail**: Creates a draft directly in your Gmail inbox using the Gmail plugin.
  * **Send Email via Gmail**: 1-click dispatch with confirmation safeguards.
  * **Open in Gmail Web**: Instant web compose link pre-filled with subject and formatted body.
  * **Copy to Clipboard**: Instant copy for Slack, CRM, or custom mail clients.

### 7. ⏱️ Global Download Feedback & Real-Time Countdown Manager
* **Component**: `src/components/DownloadFeedbackModal.tsx` | **Engine**: `src/lib/download-manager.ts`
* **Visual Countdown Ring**: 3-second animated countdown ring before file download triggers, allowing users to verify filename and format.
* **Format Badges**: Color-coded badges for `.xlsx`, `.csv`, `.pptx`, `.pdf`, `.json`, and `.txt`.
* **Animated Success Confirmation**: Green checkmark modal confirms download initiation and automatically dismisses after 2.5 seconds.
* **Generation Progress Modal**: 5-stage progress timeline for PowerPoint and baseline report builds.

### 8. 🌓 Dark / Modern High-Contrast Theme Toggle
* **Tailwind & CSS**: `darkMode: "class"`, `src/app/globals.css`, `tailwind.config.ts`
* **Sleek Dark Theme**: Deep slate background (`#0b0f19`), high-contrast dark inputs, and neon brand accents (`#a3d11b`).
* **Header Toggle**: One-click `☀️ Light / 🌙 Dark` toggle with automatic system preference detection and persistent `localStorage` memory.

### 9. 🔍 Keyword Matrix & Content Studio Core
* **Multi-Format Ingest (`/api/ingest`)**: Drag & drop up to 50 CSV, TSV, TXT, XLSX, XLS, or JSON exports (Semrush, GSC, Ahrefs). Automatically detects columns, strips BOM, deduplicates by normalized keyword, filters out wrong-state/booking-site/low-volume (`SV < 10`) noise, and derives bucket names from `Group`/`Topic` columns or filenames.
* **Website Auto-Discovery (`/api/crawl-property`)**: Scans a property URL to auto-detect city/state, active sitemap pages, and pet policy.
* **Google Drive Sync (`/api/drive-sync`) & Semrush API Pull (`/api/semrush-pull`)**: Syncs exports directly from a Google Drive folder (`01-semrush/`) or pulls live keyword data via the Semrush API.
* **Zero-Touch Auto-Generate & Review Mode**: Run **Ingest → Bucket → Select → Google Doc** in one click, or review/edit the 78-keyword pool and page-to-keyword matrix before generating.
* **Keyword Report Doc (`/api/generate-kr`)**: Clones your Google Doc template, generates grounded rationales with Claude or Free Online AI, and returns a finished Google Doc link + Flag Summary.
* **Hilton Content Studio (`/api/generate-hc` & `hilton-validator.ts`)**: Generates diff-marked copy (`**bold**` additions, `~~strikethrough~~` removals), enforces Hilton character limits and USP/keyword/ADA/JS rules with auto-retry, strips `REMOVE THESE INSTRUCTIONS` blocks, and builds a formatted Hilton Google Doc.

---

## 🛠️ API Endpoints Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/seo-visibility-report` | `POST` | Generates PowerPoint Monthly Visibility Deck & crawls property services |
| `/api/client-email` | `POST` | Drafts or sends client deliverable emails via connected Gmail (`riboynjsr@gmail.com`) |
| `/api/property-autofill` | `POST` | Auto-detects hotel name, brand, city, state, and canonical URL from target website |
| `/api/crawl-property` | `POST` | Crawls property website for sitemap, meta tags, and structured amenities |
| `/api/ingest` | `POST` | Multi-format keyword ingest, deduplication, and volume filtering |
| `/api/bucket` | `POST` | Groups keywords into thematic topic clusters |
| `/api/select-kw` | `POST` | Allocates the 78-keyword master strategy pool across sitemap pages |
| `/api/generate-kr` | `POST` | Clones Google Doc template and writes grounded keyword recommendations |
| `/api/generate-hc` | `POST` | Generates rule-validated Hilton brand copy with diff markup |
| `/api/runs` | `GET/POST` | Manages and queries historical task runs and flag summaries |

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Environment Variables

See [`.env.example`](.env.example):

* `ANTHROPIC_API_KEY` — Anthropic Claude API key for rationales and copywriting. *(Fallback: Free Online AI is enabled by default when unset)*.
* `ENABLE_FREE_ONLINE_AI` — Set to `true` to use zero-cost AI fallback (Pollinations AI / Free Models).
* `GOOGLE_SERVICE_ACCOUNT_B64` — Base64-encoded Google Service Account JSON for Google Docs & Drive. Share your template Docs and target Drive folder with the service account email (`Editor` access).
* `GOOGLE_DRIVE_ROOT_FOLDER_ID` — Optional default Drive folder ID for generated docs and folder sync.
* `GOOGLE_TEMPLATE_DOC_ID_A`, `GOOGLE_TEMPLATE_DOC_ID_B`, `GOOGLE_HILTON_TEMPLATE_DOC_ID` — Google Doc template IDs.
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Optional persistence for saved task runs (`/api/runs`).
* `SEMRUSH_API_KEY` — Optional Semrush API key for direct keyword pulls (`/api/semrush-pull`).

---

## 📜 Available Scripts

```bash
npm run dev        # Start local Next.js dev server (turbopack supported)
npm run build      # Production Next.js build & type check
npm run typecheck  # Run TypeScript check (tsc --noEmit)
npm run lint       # Run ESLint (next lint)
npm test           # Run Vitest unit tests
bash scripts/auto-push.sh # Auto-commit and push latest changes to GitHub
```

---

## 🏢 Produced by Razib Marketing
Digital marketing, SEO, and GEO visibility automation studio for independent and branded luxury hotels.
