# Keyword Research — SEO/GEO & Content Studio Specification

> Source of truth for the product. Business rules live in code under `src/config/*` and are referenced here.
> Status: **Phase 1 (Ingest → Bucket → 78-KW Pool → Page Matrix) implemented.** Phases 2–3 are specified, not built.

---

## 1. Delivery Pipeline

```
Antigravity (Agentic IDE) ──► GitHub Repo (Source) ──► Vercel (Auto-Deploy & Hosting)
```

- `main` branch → Vercel Production; PR branches → Vercel Preview deployments.
- Environment variables are managed in Vercel project settings (see `.env.example`).

## 2. System Architecture

```
Browser UI (Next.js 14+ App Router / TypeScript / Tailwind)
 ├─ 1. Property Setup & Multi-CSV Dropzone (or Google Drive Folder Sync)
 ├─ 2. Template Selector (Catbird Standard Format vs. Reitz Union / Cogwheel Format)
 ├─ 3. 78-Keyword Pool & Page-to-Keyword Approval Matrix (Editable Checkpoint)
 └─ 4. Hilton SEO/GEO Content Studio (Live Character Counter + Diff Viewer)
        │
        ▼
Vercel Serverless API Routes (/api/*)
 ├─ /api/ingest      ──► Multi-file CSV/XLSX parser, deduplicator, city-exclusion filter
 ├─ /api/bucket      ──► Deterministic bucketing engine + 78-keyword quota allocator
 ├─ /api/select-kw   ──► Page-to-Keyword matcher (KD < 45 rule + high-volume exception flag)
 ├─ /api/generate-kr ──► LLM API (Rationale generation) + Google Docs API (Keyword Doc builder)
 └─ /api/generate-hc ──► LLM API (Hilton copy rewriter + QA enforcement) + Google Docs API
        │
        ▼
Storage & External Integrations
 ├─ Database: Supabase Postgres (Properties, Runs, 78-KW Pools, Approved Matrix)
 ├─ Google Workspace: Google Drive API (Folder/Template cloning) & Google Docs API
 └─ AI Engine: Anthropic Claude (`claude-sonnet-4-5`, fallback `claude-3-5-sonnet-latest`) — temperature = 0.2
```

### 2.1 Tech choices

| Concern | Choice |
|---|---|
| Framework | Next.js 14+ App Router, TypeScript (strict), Tailwind CSS |
| Parsing | `papaparse` (CSV), SheetJS `xlsx` (XLSX/XLS) |
| Validation | `zod` on every API boundary |
| Database | Supabase Postgres + SQL migrations in `supabase/migrations` |
| LLM | `@anthropic-ai/sdk`, `temperature: 0.2` for **all** generation calls |
| Tests | `vitest` (pure engine functions are deterministic and fully unit-tested) |

## 3. Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Property setup, multi-file ingest, cleaning, geo filter, bucketing, 78-KW allocator, page matcher, editable approval matrix, CSV export, run persistence | ✅ Built |
| 2 | `/api/generate-kr`: LLM rationale + Keyword Report Google Doc (Format A/B), bucket tables ("No Data" for empty buckets), Drive template copy | ✅ Built |
| 3 | `/api/generate-hc`: Hilton copy rewriter + QA enforcement (`hilton-validator.ts`), Content Studio (char counter + diff viewer), Google Doc template clone + native diff styling | ✅ Built |

---

## 4. Phase 1 — Keyword Engine (deterministic)

The whole pipeline is pure and deterministic: identical inputs always produce identical outputs
(stable sorts, explicit tie-breakers, no randomness, no LLM).

### 4.1 Property Setup

| Field | Purpose |
|---|---|
| `name` | Property name (e.g. "Hotel X Gainesville, Tapestry Collection by Hilton") |
| `brand` | Hilton brand (drives Half & Half eligibility in Phase 3) |
| `city`, `state` | Home market. `state` = 2-letter USPS code |
| `allowedLocations[]` | Neighborhoods, nearby towns, landmarks, universities that are *valid* geo modifiers |
| `excludedLocations[]` | Additional geo terms to always drop (e.g. competing nearby cities) |
| `pages[]` | Active sitemap pages (default Hilton sitemap in `src/config/sitemap.json`) |

### 4.2 `/api/ingest` — Multi-file parser, dedupe, cleaning, geo filter

Input: `multipart/form-data` with `files[]` (≤ **50** Semrush exports, `.csv` / `.xlsx` / `.xls`) and `property` (JSON).

1. **Parse.** Header row auto-detected in the first 10 rows. Column aliases (case-insensitive):
   - Keyword: `Keyword`, `Keywords`, `Query`, `Search term`
   - Volume: `Volume`, `Search Volume`, `Avg. monthly searches`, `SV`
   - KD: `Keyword Difficulty`, `KD`, `KD %`, `KD%`, `Difficulty`
   - Optional: `CPC`, `CPC (USD)`, `Intent`, `Group`, `Topic`, `Keyword Group`
2. **Source group.** If a `Group`/`Topic` column exists it is used as the row's source group; **otherwise the filename is the bucket name** (Semrush suffixes such as `_broad-match_us_2025-01-01` stripped).
3. **Normalize.** Lowercase, trim, collapse whitespace, normalize smart quotes.
4. **Clean KD.** `N/A`, `NA`, `n/a`, `-`, `—`, empty → `null` (flag `kd-na`). `"38%"` → `38`.
5. **Deduplicate** on normalized keyword across all files: keep max volume, first non-null KD from the highest-volume row, union of source files.
6. **Volume floor.** Drop `SV < 10` **unless** `KD < 20` **and** the keyword is a *local venue demand generator*
   (classifies into: Event Space, Wedding, Meeting, Venues, Restaurants, Dining, Bar, Rooftop Bar, Things to Do, Local Attractions). Kept rows get flag `low-sv-exception`.
7. **Geo filter.** Drop keywords containing wrong-state / wrong-city modifiers:
   - Longest-match scan over: US state names, unambiguous USPS codes, ~100 major US cities, property `excludedLocations`.
   - Property city, state (name + code), `city + state` composites and `allowedLocations` are *allowed* and win ties.
   - Any matched geo term that is not allowed → drop with reason `geo` and the offending term.

Output: `{ keywords[], dropped[], stats }` — every dropped row carries a reason (`empty`, `low-volume`, `geo`) for auditability.

### 4.3 `/api/bucket` — Deterministic bucketing + 78-keyword quota allocator

**Buckets** (`src/config/buckets.json`, 27): Hotel, Boutique, Luxury, Near Me, Map, Stay, Accommodation, Lodging, Pool,
Pet Friendly, Dog Friendly, Rooms, Lofted Studios, Suites, Deals, Special Offers, Extended Stay, Restaurants, Dining,
Bar, Rooftop Bar, Event Space, Meeting, Wedding, Venues, Things to Do, Local Attractions.

**Classification chain** (first hit wins):
1. Keyword whole-word/phrase term match → bucket with the **lowest `priority`** number (specific beats generic: Rooftop Bar < Bar, Dog Friendly < Pet Friendly, Lofted Studios < Rooms, Special Offers < Deals, Extended Stay < Stay, … Hotel last).
2. Source group (Group/Topic column or filename) term match → that bucket.
3. Source group used verbatim as a **custom bucket** (filename-as-bucket rule).
4. `Unassigned`.

**78-keyword quota allocator** (`src/config/rules.ts`):
1. Reserve **1 primary per active sitemap page** (see 4.4).
2. Format B only: reserve 1 secondary per active page.
3. Fill remaining slots up to **78 total** by `Volume DESC` (tie-break: KD ASC, null KD last, keyword ASC).
   Optional `maxPerBucket` cap (default off). `Unassigned` excluded by default.
4. Everything not selected is returned as `reserve` (available for manual swaps).

### 4.4 `/api/select-kw` — Page-to-Keyword matcher

For each active page in sitemap order, candidates = keywords whose bucket ∈ `page.buckets` and not already used as a primary.

Ranking: **tier** → `Volume DESC` → `KD ASC` → keyword ASC, where tier is
- `0` — `KD < 45` (preferred)
- `1` — KD unknown (`N/A`) → flag `kd-unknown`
- `2` — `KD ≥ 45` → flag `kd-exception` (requires explicit approval)

**High-volume exception flag:** if the primary is tier 0 but a `KD ≥ 45` candidate has
`volume ≥ max(500, 2 × primary volume)`, it is surfaced as `exceptionCandidate` with flag `high-sv-exception-available`
(never auto-selected).

Each matrix row: `page`, `primary`, `secondary` (Format B), top-5 `alternatives`, `exceptionCandidate`, `flags[]`, `status`
(`pending` | `approved` | `edited`). Pages without candidates get flag `no-candidates`.

### 4.5 Approval Matrix (Editable Checkpoint, UI step 3)

- Swap primary/secondary from alternatives or the full pool/reserve. Swapping in a reserve keyword evicts the
  lowest-volume *fill* keyword so the pool stays at exactly 78.
- Per-row approve, "Approve all", and flags shown as badges. Downstream generation (Phase 2) is blocked until every active row is approved.
- Export: CSV of pool + matrix. Save: persists the run to Supabase (`/api/runs`).

---

## 5. Report Templates (Phase 2 output, selectable in Phase 1)

| | **Format A — Standard (Catbird / Arrive)** | **Format B — Cogwheel (Reitz Union)** |
|---|---|---|
| Structure | 2-col table `Page \| Keyword` | `Current Sitemap` section, then 3-col table `Page \| Keyword \| Secondary` |
| Rationale | `Why did we do this?` bullet list | `Comments` paragraphs |
| Secondary KWs | No | Yes (allocated in Phase 1) |

Config: `src/config/templates.ts`.

## 6. Phase 2 — `/api/generate-kr` (Keyword Report)

- Input: `{ runId }` (loaded from Supabase) OR `{ property, pages, template, matrix, allocation }`. Rejects if any active matrix row is not `approved`.
- LLM (Claude `claude-3-5-sonnet-latest` / `DEFAULT_MODEL`, `temperature: 0.2`) writes rationale per page using only provided data (volume, KD, bucket, flags, property notes/URL). No invented metrics:
  - **Format A (`Why did we do this?`):** concise bullet per active page citing target keyword, SV, KD, and strategic fit.
  - **Format B (`Comments`):** structured paragraph per active page covering primary + secondary keyword pairing, SV/KD balance, and sitemap alignment.
- Google Drive v3 + Google Docs v1 (`googleapis`):
  - Copies `GOOGLE_TEMPLATE_DOC_ID_A` / `GOOGLE_TEMPLATE_DOC_ID_B` into `GOOGLE_DRIVE_ROOT_FOLDER_ID` (or creates a new Doc if no template ID is configured).
  - Populates header, `Current Sitemap` (Format B), Recommendation Table (`Page | Keyword` or `Page | Keyword | Secondary`), Rationale section, and all 78-Keyword Bucket Tables (inserting `"No Data"` for empty buckets).
  - Returns `{ docId, docUrl, rationales, template, usedTemplateCopy }`.

## 7. Phase 3 — `/api/generate-hc` (Hilton Copy) — Rules

Config: `src/config/hilton-rules.ts`. QA is enforced server-side after generation; violations are returned and block export.

| Section | Rule |
|---|---|
| Home Headline | ≤ **50** chars |
| Home Description | ≤ **350** chars. **Strict edit mode**: output existing copy with additions as `**bold**` and removals as `~~strikethrough~~` |
| USP Callout | ~**350** chars (target, ±10%) |
| Half & Half | **Yes only** for Canopy, Curio, Graduate, Motto, Tapestry, Tempo, Outset; otherwise "No" |
| Location | ≤ **150** chars |
| Dining Main | ≤ **300** chars + **2 USPs** |
| Dining Outlets | ≤ **300** chars (or **400** if grandfathered), max **1** link |
| Rooms / Suites | Primary keyword + **2 USPs** + Hilton ADA legal copy + JS note |
| Hotel Info / Offers / Gallery | Fixed boilerplate (no generation) |
| Events | Fix factual errors + up to **3** spotlight focus points only. **No rewrites.** |

Content Studio UI: live character counter per field (red when over limit), side-by-side diff viewer (original vs. proposed).

---

## 8. Data Model (Supabase) — `supabase/migrations/0001_init.sql`

- `properties` — name, brand, city, state, allowed/excluded locations, pages (jsonb)
- `runs` — property_id, template (`A`|`B`), status, stats (jsonb), rules snapshot (jsonb), created_at
- `run_keywords` — the 78-KW pool + reserve: keyword, volume, kd, bucket, role (`primary`|`secondary`|`fill`|`reserve`), flags
- `run_matrix` — page_id, path, title, primary/secondary keyword, flags, status, approved_at

RLS enabled on all tables; server routes use the service-role key only on the server.

## 9. API Contracts

| Route | Method | Body | Returns |
|---|---|---|---|
| `/api/ingest` | POST | multipart: `files[]`, `property` | `IngestResult` |
| `/api/bucket` | POST | `{ keywords, pages, template, rules? }` | `{ keywords (bucketed), summary, allocation }` |
| `/api/select-kw` | POST | `{ keywords (bucketed), pages, template, rules? }` | `{ matrix, allocation }` |
| `/api/runs` | POST | `{ property, template, allocation, matrix, stats }` | `{ runId }` (503 if Supabase not configured) |
| `/api/generate-kr` | POST | `{ runId }` | 501 until Phase 2 |
| `/api/generate-hc` | POST | `{ runId, sections }` | 501 until Phase 3 |

## 10. Non-functional

- **Determinism:** engine has unit tests asserting stable output.
- **Vercel limits:** request body ≤ 4.5 MB. Semrush exports are typically small; for larger batches Phase 2 adds
  direct-to-Supabase-Storage upload or Drive folder sync.
- **Secrets:** never exposed to the client (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, Google service account).

