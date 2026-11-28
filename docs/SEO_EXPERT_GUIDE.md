# SEO‑Expert Guide for **SEO — Universal Autonomous SEO & GEO Engine**

> **Purpose** – This document explains how an SEO specialist can use the SEO Studio SEO extension to audit any website (hospitality or universal), visualize results, and automatically apply safe fixes via the self‑healing CMS layer.

---

## 1️⃣ Project Overview

| Component | Role |
|---|---|
| **manifest.json** | Chrome Manifest V3 – declares permissions, background service worker, side‑panel UI, and content script injection. |
| **src/background/** | Lifecycle controller (`LifecycleController`) that locks a tab, tracks audit state, and coordinates the pipeline. |
| **src/content/** | `controlledAutoScroll` (lazy‑load trigger), `extractPageContext` (page data collector), `spa‑observer` (detect SPA navigation). |
| **src/core/** | Configuration (`SiteConfig`), detection (`site‑detector` – to be added), template engine (`renderTemplate`), orchestration (`CentralAuditOrchestrator`) and audit tools (SEO, schema, performance, GEO). |
| **src/modules/universal/** | Mode‑specific adapters (`ecommerce`, `saas`, `local_business`, `editorial`) that implement the actual audit heuristics. |
| **src/gateway/** | CMS connectors (WordPress, Shopify, universal edge) and the **self‑healing patch** logic (`deploySelfHealingPatch`). |
| **src/ui/dashboard.html** | Fully‑styled side‑panel UI (header, navigation, main, aside, footer) built with Tailwind, dark‑mode, and semantic HTML5 landmarks (required by `ENGINEERING_STANDARDS.md`). |
| **scripts/** | `check-brand-hygiene.ts` (blocks private client identifiers), `build-extension.js` (extension packaging), build/export helpers. |
| **.github/workflows/ci.yml** | CI pipeline – typecheck, lint, brand hygiene, SEO gates, Vitest, integration tests, pytest, production build. Commits are made by intent, never by CI. |

---

## 2️⃣ Installation & Development Setup

1. **Clone the repo** (replace `<repo‑url>` with your GitHub URL):
   ```bash
   git clone <repo‑url>
   cd SEO-Studio
   ```
2. **Install Node dependencies** (Node 20 is required by the CI):
   ```bash
   npm ci
   ```
3. **Install Python dependencies** (used by the NLP generators):
   ```bash
   pip install -r python/requirements.txt
   ```
4. **Run the local build** – generates compiled assets in `dist/`:
   ```bash
   npm run build
   ```
5. **Load the extension in Chrome**:
   - Open `chrome://extensions/` → **Enable Developer mode**.
   - Click **Load unpacked** and select the project root.
   - The side‑panel will appear under the extension icon.

---

## 3️⃣ Running an Audit (SEO‑Expert workflow)

1. **Navigate to any page** you wish to audit (e‑commerce, SaaS, blog, etc.).
2. Open the SEO Studio side‑panel (extension icon → *Open SEO Dashboard*).
3. Click the **Run Audit** button in the header.
   - The content script triggers `controlledAutoScroll` to force lazy‑loaded resources to render.
   - `extractPageContext` collects meta tags, Open Graph, headings, JSON‑LD, links, images, performance metrics, and a navigation‑timing snapshot.
4. The **CentralAuditOrchestrator** registers all audit tools (metadata, schema, content, performance, accessibility, GEO) and executes them in concurrent batches (default 2 tools, 120 ms throttle).  
5. Results are streamed back to the side‑panel:
   - **Summary** – overall status, engine mode (`auto`, `hospitality`, `universal`), site type.
   - **Issues table** – each row shows Issue ID, Category, Severity, and a recommended action.
   - **Artifacts** – preview of the generated `metaTitle`, `metaDescription`, JSON‑LD, and GEO citation block.
6. **Export** – the UI can be extended with a *Download JSON* button (simple `blob` download) to save the full `UnifiedAuditReport`.

---

## 4️⃣ Interpreting the Report

| Category | What to look for | Typical Fixes |
|---|---|---|
| **metadata** | Missing or too long `<title>` / `<meta description>` (must obey 50‑60 / 145‑155 char limits from `ENGINEERING_STANDARDS.md`). | Use `renderTemplate` to inject correct values, optionally via the self‑healing patch. |
| **schema** | Invalid or missing JSON‑LD (`@type` not matching page content). | Generate a proper schema block using the *template engine* and apply with the CMS connector. |
| **content** | Low word count, missing H1, duplicate headings, missing alt text on images. | Add missing headings or alt attributes via the patch system; content suggestions appear in the *Recommendation* column. |
| **performance** | Large CLS, uncompressed images, missing `rel=preload`. | Inject `<link rel="preload">` tags or replace images with WebP/AVIF (detected by `isModernFormat`). |
| **accessibility** | Missing ARIA labels, low contrast (check with the `a11y-debugging` skill if needed). | Add ARIA attributes or adjust CSS (patch can inject a style‑block). |
| **geo** | No local business citations, missing structured address. | Use the **GEO** adapter to add localized schema and citation block. |

---

## 5️⃣ Self‑Healing CMS Integration (Phase 4)

1. **Create a CMS connector** (`src/gateway/cms-connectors/wordpress.ts`, `shopify.ts`, etc.) implementing the `CmsConnector` interface.
2. After the orchestrator finishes, generate a `CmsMutationPatch`:
   ```ts
   const patch: CmsMutationPatch = {
     patchId: crypto.randomUUID(),
     auditId: report.auditId,
     targetUrl: report.pageUrl,
     riskLevel: 'low', // higher risk requires manual approval
     mutations: [
       { field: 'meta_title', action: 'replace', before: currentTitle, after: newTitle },
       // …other field updates
     ],
   };
   ```
3. Call `deploySelfHealingPatch(patch, connector, autoPilotEnabled)`.
   - Low‑risk patches auto‑deploy when `autoPilotEnabled` is `true`.
   - The function captures a pre‑change snapshot, applies mutations, waits 15 s, verifies the page (HTTP 200 + JSON‑LD syntax), and rolls back on failure.
4. **Review** – If the patch is medium/high risk, the function returns `queued for manual operator approval`. The SEO expert can then approve via a simple UI button that re‑calls the deploy function.

---

## 6️⃣ Adding New Universal Adapters

1. **Create a new file** under `src/modules/universal/adapters/` (e.g., `restaurant.ts`).
2. Export a function that matches the `AuditTool` signature:
   ```ts
   export const restaurantAudit: AuditTool = {
     name: 'restaurant',
     async run(ctx, config) {
       const issues: AuditIssue[] = [];
       // custom heuristics → push to issues
       return issues;
     },
   };
   ```
3. Register the tool in the orchestration bootstrap (e.g., `src/core/orchestration/audit-pipeline.ts`):
   ```ts
   orchestrator.registerTool(restaurantAudit);
   ```
4. The engine will automatically include it in the next audit run.

---

## 7️⃣ CI / Release Workflow

- **Push** → GitHub Actions runs `ci.yml`:
  1. TypeScript typecheck and lint.
  2. Brand hygiene and SEO integrity gates.
  3. Vitest, `node:test`, and pytest suites.
  4. Production Next.js build.
  5. No files are committed back to the repository by CI; generated changes must be committed by a human with an intent-based message.
- **Release** – Create a tag (e.g., `v2.0.0`) and GitHub Actions can be extended to publish the Chrome‑Web‑Store package.

---

## 8️⃣ Quick Checklist for an SEO‑Ready Run

1. **Run `npm ci` and `pip install -r python/requirements.txt`.**
2. **Build the extension** – `npm run build`.
3. **Load the unpacked extension** in Chrome.
4. **Open the side‑panel** and click **Run Audit** on a target page.
5. **Review the Issues table** – address any `high` severity items first.
6. **If you have a CMS connector**, enable *Auto‑Pilot* for low‑risk patches or manually approve higher‑risk ones.
7. **Export the JSON report** for stakeholder sharing.
8. **Commit any generated artifacts** (upgraded templates, regenerated schemas) with an intent-based message – CI never commits on your behalf.

---

## 9️⃣ Helpful Commands (for the terminal)

```bash
# lint & test
npm run lint          # runs tsc --noEmit
npm run test          # vitest
ruff check python     # Python linter
mypy python           # Python type check
pytest -q python      # Python tests

# build & watch (development)
npm run dev          # Vite dev server for UI components (if you add React/Vite)

# check for private client identifiers before committing
npm run lint:brands
```

---

## 🎯 Bottom‑Line for the SEO Expert
- **All audit logic lives in TypeScript**, so the extension works entirely client‑side without external services (except optional CMS APIs).  
- The **visual dashboard** gives you an instant, readable view of every issue across the six core categories.  
- **Self‑healing patches** let you automatically fix low‑risk SEO problems directly in WordPress/Shopify/etc., while higher‑risk changes stay behind a manual approval gate.  
- The **CI pipeline** guarantees that every commit passes lint, tests, and generates a hard‑coded‑string audit, ensuring code quality and zero broken links (as required by `ENGINEERING_STANDARDS.md`).

Feel free to ask for any additional components (e.g., a React version of the dashboard, more CMS connectors, or custom audit tools) and I’ll scaffold them for you. Happy auditing! 🚀
