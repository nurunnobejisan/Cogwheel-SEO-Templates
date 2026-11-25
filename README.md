# Cogwheel SEO — Universal Autonomous SEO & GEO Engine

> **A Chrome extension that audits any website (hospitality or universal), provides SEO, schema, performance, accessibility, and GEO recommendations, and can auto‑apply safe fixes via self‑healing CMS patches.**

---

## 📦 Repository Overview

```
Cogwheel-SEO-Templates/
├─ .github/
│  ├─ workflows/ci.yml                 # CI pipeline (lint, test, build, auto‑push)
│  └─ ISSUE_TEMPLATE/
│     ├─ bug_report.md                # Template for bug reports
│     └─ feature_request.md           # Template for feature requests
├─ src/
│  ├─ background/
│  │   ├─ lifecycle-controller.ts     # Tab lock & state machine
│  │   └─ service-worker.ts           # MV3 service worker entry point
│  ├─ content/
│  │   ├─ auto-scroll.ts              # Controlled lazy‑load scrolling
│  │   ├─ spa-observer.ts              # SPA navigation detection
│  │   ├─ context-extractor.ts         # PageContext extraction
│  │   └─ content.ts                   # Content‑script bootstrap
│  ├─ core/
│  │   ├─ config/site-config.ts       # SiteConfig & EngineMode types
│  │   ├─ detection/site-detector.ts   # (to be added) – auto mode detection
│  │   ├─ templates/template-engine.ts # Mustache‑like rendering with fallbacks
│  │   ├─ orchestration/
│  │   │   ├─ central-audit-orchestrator.ts # Orchestrates audit tools
│  │   │   └─ audit-pipeline.ts        # (bootstrap for running the orchestrator)
│  │   └─ ai/patch-generator.ts        # LLM routing for patch generation
│  ├─ modules/
│  │   ├─ hospitality/                # Preserved hotel‑specific logic
│  │   └─ universal/
│  │       ├─ adapters/                # ecommerce, saas, local‑business, editorial
│  │       └─ templates/universal-presets.ts
│  ├─ tools/
│  │   ├─ seo-audit.ts
│  │   ├─ schema-audit.ts
│  │   ├─ content-audit.ts
│  │   ├─ performance-audit.ts
│  │   └─ geo-audit.ts
│  └─ ui/dashboard.html               # Side‑panel UI (Tailwind, dark‑mode, semantic HTML5)
├─ gateway/
│  ├─ cms-connectors/                # WordPress, Shopify, etc. (implement `CmsConnector`)
│  └─ self-healing-patch.ts          # Deploys patches with snapshot & rollback
├─ scripts/
│  ├─ hardcoded-audit.ts              # Scans repo for hospitality‑specific strings
│  ├─ generate-audit-summary.ts       # Generates `AUDIT_SUMMARY.md`
│  └─ git-auto-push.ts                # Auto‑commit & push utility for CI
├─ tests/                              # Vitest & Pytest suites (to be expanded)
├─ .github/workflows/ci.yml            # CI definition (lint, test, build, auto‑push)
├─ manifest.json                       # MV3 manifest (permissions, side‑panel, content script)
├─ package.json
├─ tsconfig.json
├─ pyproject.toml
├─ requirements.txt                    # Python deps for NLP helpers
├─ SEO_EXPERT_GUIDE.md                 # SEO‑expert documentation (created earlier)
└─ README.md                           # **You are here**
```

---

## 🛠️ Getting Started

1. **Clone the repository**
   ```bash
   git clone <YOUR_GITHUB_URL>
   cd Cogwheel-SEO-Templates
   ```
2. **Install dependencies**
   ```bash
   npm ci                     # Node dependencies (Node 20)
   pip install -r requirements.txt   # Python dependencies for generators
   ```
3. **Build the extension**
   ```bash
   npm run build   # Emits compiled assets to `dist/`
   ```
4. **Load the unpacked extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked** → select the project root
5. Open the side‑panel via the extension icon and click **Run Audit**.

---

## 📈 CI / Release Workflow

- **GitHub Actions** (`.github/workflows/ci.yml`) runs on every push/PR:
  1. Lint – Ruff (Python), Mypy, TypeScript (`tsc --noEmit`).
  2. Test – Vitest (TS) + Pytest (Python).
  3. Build – `npm run build`.
  4. Run `scripts/hardcoded-audit.ts` → produces `AUDIT_SUMMARY.md` (artifact).
  5. If on `main`, `scripts/git-auto-push.ts` auto‑commits generated artifacts.
- **Release** – Tag a new version (`git tag v2.0.0 && git push --tags`).  Extend the workflow to publish to the Chrome Web Store if needed.

---

## 🤝 Contributing

Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed guidelines on how to:
- Fork the repo and create a feature branch.
- Run the development environment (`npm run dev`).
- Add new audit tools or universal adapters.
- Write unit tests and keep TypeScript coverage high.
- Submit a pull request that passes CI.

---

## 📜 Code of Conduct

We follow the Contributor Covenant Code of Conduct. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

## 📜 License

This project is licensed under the **MIT License** – see the `LICENSE` file.

---

## 📚 Additional Resources
- **SEO Expert Guide** – detailed workflow for SEO specialists: [`SEO_EXPERT_GUIDE.md`](SEO_EXPERT_GUIDE.md)
- **Template Engine Docs** – see `src/core/templates/template-engine.ts`.
- **Self‑Healing Patch Docs** – see `src/gateway/self-healing-patch.ts`.

---

*Happy auditing!* 🚀
