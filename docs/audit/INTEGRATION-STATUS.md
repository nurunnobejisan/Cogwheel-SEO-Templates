# Integration Status Report — Cogwheel Enterprise Platform
**Date:** 2026-11-23  
**Document:** `AUDIT/INTEGRATION-STATUS.md`  
**Registry Location:** `src/core/integrations/integration-manager.ts`  

---

## 1. Third-Party Service Connectivity Matrix

| Integration Name | Category | Status | Auth Mechanism | Fallback Behavior |
|---|---|---|---|---|
| **Anthropic Claude (3.5 Sonnet)** | AI LLM | Configured via `ANTHROPIC_API_KEY` | Bearer Token | Unit test mock injector (`deps.callClaude`) |
| **Supabase PostgreSQL** | Database | Configured via `SUPABASE_URL` | Service Role Key | Transparent in-memory store (`memoryProperties`, `memoryRuns`) |
| **Google Workspace (Docs / Sheets / Slides)** | Workspace | Service Account Credentials | OAuth2 / Private Key | Local JSON & Base64 download manager |
| **Google Search Console API** | Search Console | Service Account Credentials | OAuth2 / Scopes | Manual CSV ranking/query dropzone |
| **Google Analytics 4 (GA4)** | Analytics | Property ID via Data API | OAuth2 / Scopes | Historical estimate analytics |
| **Google PageSpeed Insights** | Performance | API Key via REST endpoint | API Key | PerformanceObserver in Chrome extension |
| **Google Business Profile (GBP)** | Local | OAuth 2.0 Web Application | Bearer Token | Deterministic NAP consistency scanner |
| **Semrush Keyword Ingestion** | Third-Party Data | **Active (Direct File Drop)** | No Key Required | Multi-file parser with column auto-discovery |
| **Ahrefs Backlink Ingestion** | Third-Party Data | **Active (Direct File Drop)** | No Key Required | Referring domain gap comparator |

---

## 2. Integration Hardening Principles
1. **Never Claim False Success**: An integration is only marked connected when real environment credentials exist or real files are parsed.
2. **Graceful Degradation**: If cloud credentials (Supabase, Google Workspace, Claude) are absent, the application runs fully functional in local offline mode without throwing fatal crashes.
3. **SSOT Configuration**: Environment variables and instructions are centralized in `src/core/integrations/integration-manager.ts`.
