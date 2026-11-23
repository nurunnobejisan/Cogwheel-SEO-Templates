# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Custom Fine-Tuned Model Inference Engine & Fallback Router** (`src/engine/custom-model-client.ts`):
  - Multi-provider inference support for Tuned Google Gemini (Vertex AI / Google AI Studio), custom REST API endpoints (vLLM / HuggingFace TGI), and local open-weight instances (Ollama / LoRA).
  - Zero-latency 3-tier automatic fallback to Cogwheel's local deterministic rules engine on network failure or rate limits.
  - Dedicated inference settings interface in **Settings** tab with model endpoint configuration, API keys, temperature parameters, and live latency connection testing.
- **Python Supervised Fine-Tuning (SFT) & LoRA Pipeline** (`scripts/python/fine_tune_pipeline.py`):
  - End-to-end dataset ingestion with strict Pydantic token and schema validation.
  - Deterministic 90/10 train-validation dataset split.
  - Automated generation of 4-bit Unsloth / PEFT LoRA training scripts (Llama 3, Mistral 7B) and Google Cloud Vertex AI Gemini tuning job scripts.
  - Benchmarking evaluation module comparing base vs. tuned model accuracy against 580px/920px SERP budgets and Schema.org graph syntax.
- **Dataset Tab & SFT Dataset Builder** (`src/components/DatasetVaultManager.tsx`, `src/engine/dataset-builder.ts`):
  - Full-featured **Dataset** tab in the Chrome Side Panel for reviewing, filtering, approving, or rejecting harvested training pairs.
  - Multi-format SFT dataset export supporting Google Gemini SFT (.jsonl), ChatML / OpenAI / Unsloth (.jsonl), and Alpaca (.jsonl).
  - Direct Web App API synchronization via HTTP POST with Bearer token authentication and batch progress reporting.
- **Universal DOM Training Capture & PII Sanitizer** (`src/content/training-capture.ts`, `src/storage/training-vault.ts`):
  - Read-only DOM capture extracting page structure, headings, OpenGraph metadata, and body text.
  - Automated PII redaction engine scrubbing emails, telephone numbers, and sensitive URL query credentials.
  - IndexedDB storage vault (`CogwheelTrainingVaultDB` v2) with SHA-256 canonical URL hash deduplication and multi-factor quality scoring (0-100).
- **Comprehensive System Architecture Guide Overhaul** (`docs/ARCHITECTURE.md`):
  - Detailed architectural specifications for Manifest V3 extension, ML harvesting vault, multi-provider inference ladder, SFT pipeline, and CSP/privacy governance.

## [2.7.0] - 2026-11-21

### Added
- Professional "Export Audit" dropdown in the Chrome Side Panel header providing:
  - Executive HTML Audit Report: Print-ready, white-label report with KPI scores and remediation roadmap.
  - Copy-Ready JSON-LD Package: Serialized Schema.org `@graph` for hotel web developers.
  - Portfolio CSV Export: Tabular export for monthly visibility decks and BI tracking.
- Comprehensive Vitest unit test suite covering exact SERP pixel calculations, 5 hotel brand guardrails, JSON-LD schema integrity, and SemVer comparisons.
- Single Source of Truth data validation architecture with TypeScript Zod schemas (`src/schemas/`) and JSON Schema Draft-7 exports (`schemas/`).
- Python 3.11+ Pydantic models (`scripts/python/models.py`), schema validation CLI, and batch portfolio auditor.
- Automated two-layer free update engine: Layer A silent Over-The-Air (OTA) rule sync and Layer B binary update notification banner.
- Unified CI workflow (`.github/workflows/ci.yml`) running TypeScript typecheck, Vitest tests, Next.js build, Python ruff/mypy checks, and JSON dataset validation.

### Changed
- Replaced oversized glowing radial gauges with precision tabular micro-gauges inspired by Linear and Vercel design aesthetics.
- Removed all raw emojis from user interface components in favor of crisp 16px Lucide icons.
- Updated pixel budget triggers for Google Title (580px ceiling) and Meta Description (920px ceiling).

### Fixed
- Narrow character pixel estimation for characters like `i`, `l`, `|`, and punctuation marks.
- Localization text artifacts in audit status readouts.

## [2.6.1] - 2026-11-20

### Added
- Live SERP and Social Open Graph preview cards supporting Desktop, Mobile, and Social OG modes.
- Hotel brand guardrail checks for prohibited superlatives and discount nomenclature.

### Fixed
- DOM inspector alt tag counting and oversized image detection.

## [2.6.0] - 2026-11-16

### Added
- Initial Chrome Extension Manifest V3 side panel implementation.
- Multi-CMS export adapters for HTML, WordPress, Shopify, and Webflow.
- 78-keyword hospitality strategy matrix dataset.
