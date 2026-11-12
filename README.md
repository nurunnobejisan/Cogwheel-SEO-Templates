# Keyword Research & Hilton SEO Studio

Automated keyword research, 78-keyword pool allocation, Google Docs report generation, and Hilton SEO/GEO content drafting studio.

## Features

- **Multi-Format Ingest (`/api/ingest`)**: Drag & drop up to 50 CSV, TSV, TXT, XLSX, XLS, or JSON exports (e.g. Semrush, GSC, Ahrefs). Automatically detects columns, strips BOM, deduplicates by normalized keyword, filters out wrong-state/booking-site/low-volume (`SV < 10`) noise, and derives bucket names from `Group`/`Topic` columns or filenames.
- **Website Auto-Discovery (`/api/crawl-property`)**: Scans a property URL to auto-detect city/state, active sitemap pages, and pet policy.
- **Google Drive Sync (`/api/drive-sync`) & Semrush API Pull (`/api/semrush-pull`)**: Syncs exports directly from a Google Drive folder (`01-semrush/`) or pulls live keyword data via the Semrush API.
- **Zero-Touch Auto-Generate & Review Mode**: Run **Ingest → Bucket → Select → Google Doc** in one click, or review/edit the 78-keyword pool and page-to-keyword matrix before generating.
- **Keyword Report Doc (`/api/generate-kr`)**: Clones your Google Doc template, generates grounded rationales with Claude (`temperature = 0.2`), and returns a finished Google Doc link + Flag Summary.
- **Hilton Content Studio (`/api/generate-hc` & `hilton-validator.ts`)**: Generates diff-marked copy (`**bold**` additions, `~~strikethrough~~` removals), enforces Hilton character limits and USP/keyword/ADA/JS rules with auto-retry, strips `REMOVE THESE INSTRUCTIONS` blocks, and builds a formatted Hilton Google Doc.

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

See [`.env.example`](.env.example):

- `ANTHROPIC_API_KEY` — Required for rationale generation (`/api/generate-kr`) and Hilton copywriting (`/api/generate-hc`).
- `GOOGLE_SERVICE_ACCOUNT_B64` — Base64-encoded Google Service Account JSON for Google Docs & Drive. Share your template Docs and target Drive folder with the service account email (`Editor` access).
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` — Optional default Drive folder ID for generated docs and folder sync.
- `GOOGLE_TEMPLATE_DOC_ID_A`, `GOOGLE_TEMPLATE_DOC_ID_B`, `GOOGLE_HILTON_TEMPLATE_DOC_ID` — Google Doc template IDs.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Optional persistence for saved runs (`/api/runs`).
- `SEMRUSH_API_KEY` — Optional Semrush API key for direct keyword pulls (`/api/semrush-pull`).

## Scripts

```bash
npm run dev        # Start local Next.js dev server
npm run typecheck  # Run TypeScript check (tsc --noEmit)
npm run lint       # Run ESLint (next lint)
npm test           # Run Vitest unit tests
npm run build      # Production build
```

