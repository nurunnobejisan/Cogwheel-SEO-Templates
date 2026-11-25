<p align="center">
  <img src="public/razib-marketing-logo.png" alt="Cogwheel SEO" width="120" />
</p>

<h1 align="center">Cogwheel SEO — Universal Autonomous SEO & GEO Engine</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Code%20of%20Conduct-Contributor%20Covenant-orange.svg" alt="Code of Conduct" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-3.0.0-purple.svg" alt="Version 3.0.0" /></a>
</p>

<p align="center">
  A Chrome extension + Next.js platform that audits any website, provides SEO, schema, performance, accessibility, and GEO recommendations, and can auto‑apply safe fixes via self‑healing CMS patches.
</p>

---

## 📂 Repository Structure

```
Cogwheel-SEO-Templates/
│
├── 📋 Root Config & Metadata
│   ├── package.json / package-lock.json    # Node dependencies
│   ├── pyproject.toml / requirements.txt   # Python dependencies
│   ├── tsconfig.json                       # TypeScript config
│   ├── vitest.config.ts                    # Test runner config
│   ├── tailwind.config.ts                  # Tailwind CSS config
│   ├── postcss.config.mjs                  # PostCSS config
│   ├── next.config.mjs                     # Next.js config
│   ├── manifest.json                       # Chrome extension manifest (MV3)
│   ├── README.md                           # ← You are here
│   ├── CONTRIBUTING.md                     # Contribution guidelines
│   ├── CODE_OF_CONDUCT.md                  # Contributor Covenant
│   ├── CHANGELOG.md                        # Release history
│   └── LICENSE                             # MIT License
│
├── 📁 src/                                 # Main TypeScript source code
│   ├── app/                                # Next.js app router pages
│   ├── background/                         # Chrome extension service worker
│   ├── components/                         # React UI components
│   ├── content/                            # Content scripts (extraction, SPA)
│   ├── core/                               # Orchestration, templates, AI routing
│   ├── engine/                             # Audit engine pipeline
│   ├── generators/                         # Report generators
│   ├── gateway/                            # CMS connectors & self-healing patches
│   ├── tasks/                              # Task modules (keyword, meta, schema…)
│   ├── schemas/                            # Zod schemas for task data
│   ├── scoring/                            # SEO scoring algorithms
│   ├── storage/                            # IndexedDB / Chrome storage layer
│   ├── types/                              # Shared TypeScript types
│   └── ui/                                 # Side-panel dashboard HTML
│
├── 📁 python/                              # Python automation & analysis
│   ├── analyzer/                           # GEO scoring
│   ├── crawler/                            # Site mapper
│   ├── generators/                         # Keyword, meta, heading, image tools
│   ├── models/                             # Pydantic data models
│   ├── processor/                          # Template processor
│   ├── scraper/                            # Hotel data extractor
│   ├── scripts/                            # Batch, fine-tuning, schema validation
│   └── cogwheel_auto.py                    # CLI entry point
│
├── 📁 chrome-extension/                    # Standalone Chrome extension build
│   ├── src/                                # Extension-specific source
│   ├── dist/                               # Built extension output
│   └── package.json                        # Extension dependencies
│
├── 📁 api/                                 # Python API servers
│   ├── content_engine.py                   # Content generation API
│   ├── gsc_server.py                       # Google Search Console API
│   ├── models.py                           # API data models
│   └── seo_visibility_report.py            # SEO visibility report API
│
├── 📁 schemas/                             # JSON Schema & TypeScript schema defs
│   ├── *.schema.json                       # JSON Schema files
│   └── *.ts                                # TypeScript schema builders
│
├── 📁 templates/                           # SEO audit prompt templates
│   ├── hotel-*.md / hotel-*.html           # Hotel-specific templates
│   └── *.md                                # Universal templates
│
├── 📁 validators/                          # SEO validation utilities
│   ├── canonicalNormalizer.ts
│   ├── internalLinker.ts
│   ├── serpOptimizer.ts
│   └── ...
│
├── 📁 exporters/                           # CMS export adapters
│   ├── wordPressExporter.ts
│   ├── shopifyExporter.ts
│   └── webflowExporter.ts
│
├── 📁 tests/                               # All test suites
│   ├── *.test.ts                           # Vitest unit & integration tests
│   ├── ts/                                 # TypeScript test helpers & suites
│   ├── python/                             # Pytest suites
│   ├── e2e/                                # End-to-end tests
│   └── fixtures/                           # Test fixture data
│
├── 📁 docs/                                # All documentation
│   ├── ARCHITECTURE.md                     # System architecture overview
│   ├── SPEC.md                             # Technical specification
│   ├── SECURITY.md                         # Security policy
│   ├── GEMINI.md                           # AI agent coding rules
│   ├── SEO_EXPERT_GUIDE.md                 # SEO workflow guide
│   ├── PROJECT_STRUCTURE.md                # Detailed structure reference
│   ├── INVENTORY.md                        # Feature inventory
│   ├── PROGRESS.md                         # Development progress tracker
│   ├── TASKS.md                            # Task backlog
│   ├── ATTRIBUTION.md                      # Third-party attributions
│   ├── audit/                              # Audit reports & reviews
│   ├── assets/                             # Diagrams & images
│   └── reports/                            # CI/fix reports
│
├── 📁 data/                                # Static data & training sets
│   ├── google-updates.json                 # Algorithm update database
│   ├── 78-keyword-strategy-matrix.json     # Keyword strategy data
│   ├── models/                             # Model registry
│   └── training/                           # Fine-tuning datasets
│
├── 📁 scripts/                             # Build & automation scripts
│   ├── *.ts                                # TypeScript utilities
│   ├── *.sh                                # Shell scripts
│   └── *.py                                # Python helpers
│
├── 📁 examples/                            # Example configurations
├── 📁 public/                              # Static assets & extension bundle
├── 📁 supabase/migrations/                 # Database migration SQL
├── 📁 output/                              # Generated audit output (per-site)
│
├── 📁 .github/                             # GitHub configuration
│   ├── workflows/                          # CI/CD pipelines
│   │   ├── ci.yml
│   │   ├── auto-release.yml
│   │   └── seo-integrity.yml
│   ├── ISSUE_TEMPLATE/                     # Bug & feature request templates
│   └── pull_request_template.md
│
└── 📁 .husky/                              # Git hooks (commit-msg, pre-commit)
```

---

## 🛠️ Getting Started

```bash
# 1. Clone
git clone https://github.com/jisan-razibmarketing/Cogwheel-SEO-Templates.git
cd Cogwheel-SEO-Templates

# 2. Install dependencies
npm ci                            # Node (requires Node 20+)
pip install -r requirements.txt   # Python (3.11+)

# 3. Build
npm run build                     # Compile TypeScript & extension

# 4. Load Chrome extension
# → chrome://extensions/ → Developer mode → Load unpacked → select project root
```

---

## 📈 CI / Release Workflow

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push/PR:

1. **Lint** – Ruff + Mypy (Python), TypeScript (`tsc --noEmit`)
2. **Test** – Vitest (TS) + Pytest (Python)
3. **Build** – `npm run build`
4. **Audit** – `scripts/hardcoded-audit.ts` → generates `AUDIT_SUMMARY.md`
5. **Auto-push** – On `main`, commits generated artifacts

**Release** – Tag with `git tag v3.x.x && git push --tags`.

---

## 🤝 Contributing

Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines on forking, branching, testing, and submitting pull requests.

## 📜 Code of Conduct

We follow the [Contributor Covenant](CODE_OF_CONDUCT.md).

## 📄 License

[MIT License](LICENSE) — see the `LICENSE` file.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture & diagrams |
| [`docs/SPEC.md`](docs/SPEC.md) | Technical specification |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security policy & reporting |
| [`docs/SEO_EXPERT_GUIDE.md`](docs/SEO_EXPERT_GUIDE.md) | Workflow guide for SEO specialists |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Detailed repo structure reference |
| [`docs/GEMINI.md`](docs/GEMINI.md) | AI agent coding rules |
| [`docs/audit/`](docs/audit/) | Architecture reviews & audit reports |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |

---

<p align="center"><em>Happy auditing!</em> 🚀</p>
