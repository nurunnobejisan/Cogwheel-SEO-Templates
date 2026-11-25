# Source Code Attribution & License Inventory
**Cogwheel SEO & GEO Studio — Unified Platform Integration**

This document records the provenance, licensing, technical scope, and integration mapping for code, prompts, tools, workflows, and datasets integrated from the three open-source repositories:
1. **`claude-seo`** (AgriciDaniel/claude-seo)
2. **`open-seo`** (every-app/open-seo)
3. **`mcp-gsc`** (AminForou/mcp-gsc)

All three upstream projects are licensed under the permissive **MIT License**, permitting free reuse, modification, merging, publishing, distribution, and sublicensing with attribution.

---

## 1. Upstream Repositories Overview

| Repository | Upstream Author | License | Primary Architectural Contribution |
|---|---|---|---|
| [`AgriciDaniel/claude-seo`](https://github.com/AgriciDaniel/claude-seo) | agricidaniel | MIT | 20 Specialized SEO Agents, 60+ Python audit/crawl scripts, Google Core Update History dataset, SXO/GEO workflows |
| [`every-app/open-seo`](https://github.com/every-app/open-seo) | Ben Senescu | MIT | TypeScript MCP tools (GSC, GA4, Site Audit, Backlinks, SERP tracking, AI Visibility, DataForSEO), workflow engines |
| [`AminForou/mcp-gsc`](https://github.com/AminForou/mcp-gsc) | Amin Foroutan | MIT | 21 Google Search Console API tools, period-over-period search analytics, URL inspection API, sitemap tools, workflow skills |

---

## 2. Detailed Module & File Integration Mapping

### A. Google Search Console & URL Inspection (`mcp-gsc`)
* **Original Repository:** `https://github.com/AminForou/mcp-gsc`
* **Original License:** MIT License, Copyright (c) 2025 Amin Foroutan
* **Destination in Cogwheel:**
  - `src/core/gsc/client.ts` & `src/core/gsc/types.ts`: TypeScript adapter for Search Console queries, indexing inspection, sitemaps, and period comparisons.
  - `api/gsc_server.py`: Standalone FastMCP server maintaining native Python FastMCP tool interface for desktop and MCP clients.
  - `src/tasks/gsc-intelligence/`: Automated periodic task runner for search analytics and cannibalization detection.
* **Key Features Reused:**
  - `list_properties`, `get_search_analytics`, `get_advanced_search_analytics`
  - `inspect_url_enhanced`, `batch_url_inspection`, `check_indexing_issues`
  - `compare_search_periods`, `get_search_by_page_query`
  - `get_performance_overview`, `get_sitemaps`, `submit_sitemap`
* **Changes Made:**
  - Added support for both Python FastMCP and TypeScript native runtime via `@/core/google`.
  - Integrated OAuth credentials with Cogwheel's existing `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_SERVICE_ACCOUNT_B64` fallback flow.

### B. Specialized SEO Agents & Technical Tool Scripts (`claude-seo`)
* **Original Repository:** `https://github.com/AgriciDaniel/claude-seo`
* **Original License:** MIT License, Copyright (c) 2026 agricidaniel
* **Destination in Cogwheel:**
  - `src/core/claude-seo/`: Python and TypeScript execution bridge for on-page audits, structured data, sitemaps, and core updates.
  - `src/ai/prompts/agents/`: 20 specialized SEO system prompt profiles (`seo-technical`, `seo-content`, `seo-cluster`, `seo-geo`, `seo-schema`, etc.).
  - `data/google-updates.json`: Historical catalog of Google Core algorithm updates, Helpful Content updates, and spam rollouts.
  - `src/core/claude-seo/scripts/`: Select Python utilities (`page_checks.py`, `parse_html.py`, `sitemap_discovery.py`, `url_safety.py`, `schema_generate.py`).
* **Key Features Reused:**
  - Strict SSRF and URL safety filtering.
  - Page-level SEO criteria (meta tags, open graph, twitter cards, canonicals, hreflang, structured data).
  - Search Experience Optimization (SXO) and Generative Engine Optimization (GEO) scoring criteria.
* **Changes Made:**
  - Standardized CLI flags and wrapped outputs into JSON structured objects for Cogwheel AI Model tool calls.
  - Adapted imports to Cogwheel's unified logger and config system.

### C. TypeScript MCP Suite, Backlink & AI Visibility Engines (`open-seo`)
* **Original Repository:** `https://github.com/every-app/open-seo`
* **Original License:** MIT License, Copyright (c) 2026 Ben Senescu
* **Destination in Cogwheel:**
  - `src/core/open-seo/`: TypeScript MCP tool implementations for Site Audit, AI Visibility, Backlinks, SERP analysis, and Keyword Research.
  - `src/core/open-seo/schemas.ts`: Zod schemas and validation contracts.
  - `src/core/ai-visibility/`: GEO & LLM prompt citation tracking engine (monitoring visibility in ChatGPT, Perplexity, Claude, Gemini).
* **Key Features Reused:**
  - Site audit issue definitions (`audit-issues.ts`).
  - AI visibility measurement contracts (`ai-visibility-tools.ts`, `ai-prompt-suggestions.ts`).
  - Backlinks profile and overview analysis contracts (`get-backlinks-overview.ts`, `get-backlinks-profile.ts`).
  - Keyword research and SERP rank tracking contracts (`research-keywords.ts`, `get-serp-results.ts`).
* **Changes Made:**
  - Removed proprietary Cloudflare D1/Worker dependencies in favor of Cogwheel's existing Next.js, Node.js, and Supabase/PostgreSQL schema layer.
  - Integrated with Cogwheel's 78-keyword hospitality strategy matrix.

---

## 3. License Notices

```text
================================================================================
MIT License (AgriciDaniel/claude-seo)
Copyright (c) 2026 agricidaniel
================================================================================
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

================================================================================
MIT License (every-app/open-seo)
Copyright (c) 2026 Ben Senescu
================================================================================
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

================================================================================
MIT License (AminForou/mcp-gsc)
Copyright (c) 2025 Amin Foroutan
================================================================================
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
================================================================================
```
