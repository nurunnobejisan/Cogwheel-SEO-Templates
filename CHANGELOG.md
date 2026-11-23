# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
