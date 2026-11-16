# Cogwheel SEO Templates — System Architecture & Directory Guide

This document describes the structural organization, runtime environments, and architectural design of the **Cogwheel SEO & Hospitality Templates Studio**.

---

## 1. Directory Structure & Responsibilities

| Directory | Primary Language | Purpose & Scope |
|---|---|---|
| **`/src`** | TypeScript / React | Next.js 14 App Router application, user interface components (`PropertyDashboard`, `Studio`, `LabsView`), and core hospitality workflows. |
| **`/validators`** | TypeScript | Pure, zero-dependency validation gates enforcing variable resolution, XSS escaping, canonical normalization, production noindex guards, SERP width truncation, content uniqueness, and semantic internal linking. |
| **`/schemas`** | TypeScript | Composable JSON-LD `@graph` builders for Schema.org (`Hotel`, `Article`, `Product`, `FAQPage`, `BreadcrumbList`). |
| **`/exporters`** | TypeScript | Production adapters converting hotel metadata and copy into HTML5, Shopify Liquid (`.liquid`), WordPress PHP (`functions.php`), and Webflow Collection CSV. |
| **`/api`** | Python | Python data models (Pydantic), thin-content similarity checker (Jaccard / tri-gram), and PPTX monthly visibility report generators (compatible with Vercel Python runtime). |
| **`/templates`** | HTML / Jinja / Mustache | Production hotel landing page templates (`hotel-destination-guide.html`, `hotel-room-showcase.html`, `hotel-faq-amenities.html`). |
| **`/tests`** | TypeScript & Python | Comprehensive unit, integration, and regression suites: Vitest/TS tests, Pytest layer tests, and the Master 10-Gate SEO Integrity Linter. |
| **`/scripts`** | TypeScript / Bash | DevOps and CLI utilities (`seo-preview-cli.ts`, `pre-commit.sh`, schema exporters). |
| **`/shared/schemas`** | JSON Schema | Unified data interchange contracts bridging TypeScript Zod validators with Python Pydantic models. |
| **`/supabase`** | SQL | Database migrations and relational schemas for hotel property records, crawl task runs, and visibility logs. |
| **`/public`** | Assets | Static branding, icons, and hospitality UI logos. |
| **`/docs`** | Markdown | Technical documentation, architecture guides, and CI repair reports. |

---

## 2. Technology Stack & Runtime Layers

1. **Frontend & UI**:
   - Next.js 14.2 (App Router)
   - React 18
   - Tailwind CSS with custom ambient lighting and spring-curve micro-interactions
2. **Core SEO Engine**:
   - TypeScript 5.5 in strict mode
   - Zod runtime validation
   - `schema-dts` for strictly-typed JSON-LD structured data
3. **Data Intelligence & PPTX Generation**:
   - Python 3.11+
   - Pydantic v2
   - `python-pptx`, `jinja2`, `beautifulsoup4`
4. **CI/CD Quality Gates**:
   - GitHub Actions (`.github/workflows/seo-integrity.yml`)
   - Secret scan verification
   - `tsc --noEmit`
   - Vitest & Node 22 native test runner
   - Pytest
   - 10-Gate SEO Integrity Linter
