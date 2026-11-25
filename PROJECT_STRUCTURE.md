# 📂 Project Structure Overview

```
Cogwheel-SEO-Templates/
├─ .github/
│   └─ workflows/
│        └─ ci.yml                     # GitHub Actions CI (lint, test, build, auto‑push)
│   └─ ISSUE_TEMPLATE/
│        ├─ bug_report.md              # Template for filing bugs
│        └─ feature_request.md         # Template for new feature ideas
├─ .agent/                               # Antigravity internal workflows (optional)
├─ .husky/                               # Git‑hook scripts (pre‑commit, commit‑msg, …)
├─ .vscode/ (optional)                   # VS Code workspace settings
│
├─ src/                                   # Primary TypeScript source
│   ├─ background/
│   │   ├─ lifecycle-controller.ts      # Tab lock & state‑machine
│   │   └─ service-worker.ts            # Manifest V3 service worker entry
│   ├─ content/
│   │   ├─ auto-scroll.ts               # Lazy‑load trigger (controlled scroll)
│   │   ├─ spa-observer.ts               # SPA navigation detection
│   │   ├─ context-extractor.ts          # PageContext collector
│   │   └─ content.ts                    # Content‑script bootstrap
│   ├─ core/
│   │   ├─ config/
│   │   │   └─ site-config.ts           # SiteConfig, EngineMode, SiteType types
│   │   ├─ detection/
│   │   │   └─ site‑detector.ts          # Auto‑detect hospitality vs. universal
│   │   ├─ templates/
│   │   │   └─ template‑engine.ts        # Mustache‑like renderer with fallback
│   │   ├─ orchestration/
│   │   │   ├─ central‑audit‑orchestrator.ts   # Batch execution of AuditTools
│   │   │   └─ audit‑pipeline.ts                # Glue that wires tools → orchestrator
│   │   └─ ai/
│   │       └─ patch‑generator.ts        # LLM routing for patch creation
│   ├─ modules/
│   │   ├─ hospitality/                  # 100 % preserved hotel‑specific logic
│   │   └─ universal/
│   │       ├─ adapters/
│   │       │   ├─ ecommerce.ts
│   │       │   ├─ saas.ts
│   │       │   ├─ local‑business.ts
│   │       │   └─ editorial.ts
│   │       └─ templates/
│   │           └─ universal‑presets.ts
│   ├─ tools/
│   │   ├─ seo‑audit.ts
│   │   ├─ schema‑audit.ts
│   │   ├─ content‑audit.ts
│   │   ├─ performance‑audit.ts
│   │   └─ geo‑audit.ts
│   └─ ui/
│       └─ dashboard.html                # Side‑panel UI (Tailwind, semantic HTML5)
│
├─ gateway/
│   ├─ cms‑connectors/                   # WordPress, Shopify, etc. (implement `CmsConnector`)
│   └─ self‑healing‑patch.ts             # Snapshot → apply → verify → rollback
│
├─ scripts/
│   ├─ generate‑audit‑summary.ts          # Produces `AUDIT_SUMMARY.md`
│   ├─ hardcoded‑audit.ts                 # Scans repo for hospitality‑specific strings
│   └─ git‑auto‑push.ts                  # Auto‑commit & push utility used by CI
│
├─ tests/
│   ├─ ts/                               # Vitest unit tests for TS code
│   └─ python/                           # Pytest suite for Python generators
│
├─ public/                               # Static assets served by the extension
│   └─ (icons, images, manifest resources)
│
├─ docs/                                 # Long‑form documentation, diagrams, etc.
│   └─ (architecture diagrams, usage guides)
│
├─ .eslintrc.json                         # Lint configuration for TypeScript/JS
├─ .gitattributes                         # Git attributes (e.g., diff drivers)
├─ .gitignore                             # Files/folders to ignore
├─ .npmrc                                 # npm configuration (registry, lockfile version)
├─ .prettierignore / .prettierrc.json     # (optional) code‑formatting rules
│
├─ .env.example                           # Example environment variables
├─ tailwind.config.ts                     # Tailwind CSS configuration
├─ tsconfig.json                          # TypeScript compiler options
├─ vitest.config.ts                       # Vitest configuration
│
├─ package.json / package-lock.json       # Node dependencies & scripts
├─ pyproject.toml / requirements.txt      # Python packaging & deps
│
├─ LICENSE                                # MIT license
├─ CODE_OF_CONDUCT.md                     # Contributor Covenant
├─ CONTRIBUTING.md                        # How to contribute & PR workflow
├─ README.md                              # Project overview (links to this file)
├─ SEO_EXPERT_GUIDE.md                    # Detailed SEO‑engine workflow for experts
├─ CHANGELOG.md                           # Release notes (v3.0.0, etc.)
├─ INVENTORY.md                           # Auto‑generated hard‑coded‑string audit
├─ GEMINI.md                              # Mandatory semantic‑HTML & SEO rules
└─ manifest.json                          # Chrome Manifest V3 (permissions, side‑panel)
```

---

## How to keep the repo tidy

| What to do | Command / Action |
|---|---|
| **Add a new top‑level folder** (e.g., `design/` for Figma files) | `mkdir design && git add design && git commit -m "Add design assets"` |
| **Move misplaced files** into their proper place (e.g., stray `.md` files) | `git mv old/path/file.md new/path/ && git commit -m "Re‑organize docs"` |
| **Update the tree in the docs** – after a major restructure, run `tree -a -I 'node_modules|dist|.git' > PROJECT_STRUCTURE.md` and commit the updated file. | `tree -a -I 'node_modules|dist|.git' > PROJECT_STRUCTURE.md && git add PROJECT_STRUCTURE.md && git commit -m "Refresh project‑structure diagram"` |
| **Enforce the structure via CI** – add a simple lint step in `.github/workflows/ci.yml` that runs `npm run lint && python -m flake8 .` (already present). |
| **Keep the inventory up‑to‑date** – the script `scripts/hardcoded-audit.ts` is run in CI and writes `AUDIT_SUMMARY.md`; its output is attached as a CI artifact. |

---

## Quick “What‑belongs‑where?” cheat‑sheet

| Category | Examples | Destination |
|---|---|---|
| **Chrome extension code** (manifest, background, content, UI) | `manifest.json`, `src/**` | `src/` (keep UI HTML under `src/ui/`) |
| **CMS integration** | `gateway/self‑healing‑patch.ts`, connector files | `gateway/` |
| **Automation scripts** | `scripts/*.ts` | `scripts/` |
| **Documentation** | `README.md`, `SECURITY.md`, `SPEC.md` | `docs/` (or root if primary) |
| **Tests** | `tests/**/*.test.ts`, `python/**/test_*.py` | `tests/` |
| **Static assets** (icons, images) | `public/*` | `public/` |
| **Configuration files** | `tailwind.config.ts`, `tsconfig.json`, `.eslintrc.json` | root (config folder optional) |
| **Legal / community** | `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` | root |
| **Generated audit summary** | `AUDIT_SUMMARY.md` | root (created by CI) |

---

### Next steps you can take right now

1. **Create the `PROJECT_STRUCTURE.md` file** (the content above) → commit it.
2. **Add the issue‑template files** (`.github/ISSUE_TEMPLATE/bug_report.md` & `feature_request.md`).
3. **Optionally move any stray markdown files** (e.g., `SECURITY.md`, `SPEC.md`) into the `docs/` folder and update the `README` links.

Your repository will now be self‑documenting and easy for new contributors to navigate. Let me know if you’d like me to create the issue‑template files or move any docs into `docs/`. 🚀