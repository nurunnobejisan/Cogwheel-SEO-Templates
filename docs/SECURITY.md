# Security Policy

## Supported Versions

The following versions of SEO Studio are currently supported with security updates and patch releases:

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | Yes                |
| 2.x     | Critical Fixes Only|
| < 2.0.0 | No                 |

---

## Reporting a Vulnerability

The SEO Studio engineering team takes the security of our hospitality search engine optimization tools, browser extensions, and automation scripts seriously.

If you believe you have discovered a vulnerability, security flaw, or credential exposure:

1. **Do not disclose the issue publicly** on GitHub Issues, pull requests, or social channels.
2. Please report the issue privately by emailing **security@cogwheelmarketing.com** with:
   - A clear description of the vulnerability.
   - Specific steps or proof-of-concept to reproduce the behavior.
   - Affected components (Chrome Extension Side Panel, Next.js API endpoints, Python CLI scripts, or OTA synchronization channels).
   - Your name and handle for attribution (optional).

### Response Timeline
- **Initial Response**: Within 48 hours acknowledging receipt of your report.
- **Triage & Assessment**: Within 5 business days with an assessment of severity.
- **Patch Release**: High and critical issues will be prioritized for an immediate patch release.

---

## Security Practices in SEO Studio

- **Zero Secrets in Code**: Automated CI scanning ensures that no API keys, private tokens, or credentials are committed to the repository.
- **Client-Side Isolation**: The Chrome Extension Manifest V3 operates in an isolated environment and never transmits property DOM content to third-party endpoints.
- **Over-The-Air (OTA) Integrity**: Rule updates fetched from GitHub are strictly validated against schema models before ingestion.

---

## Runtime Security Controls

The following controls are enforced by the Next.js app (`src/middleware.ts`, `src/lib/security/*`, `src/lib/platform/session.ts`).

### Authentication

- Platform API routes (`/api/platform/v1/*`) require a **signed session**: an HMAC-SHA256 token in the `cw_session` cookie. The only public route is `GET /health`.
- Tokens are minted by `POST /api/platform/session` by exchanging `PLATFORM_OPERATOR_TOKEN` (a shared bootstrap secret for single-operator installs). Multi-user deployments should replace that route with an SSO callback and call `createSessionToken()`.
- `PLATFORM_SESSION_SECRET` (≥ 32 chars) signs sessions. Without it, no session can be verified and every non-health platform route returns `401`.
- The old `x-actor-role` header / unsigned `cw_actor_*` cookie scheme is ignored in production. It only works when `PLATFORM_DEV_AUTH=1` **and** `NODE_ENV !== "production"`.

### SSRF / outbound egress

- Every user-supplied URL passes `validateTargetUrl()` (scheme, hostname shape, literal private/reserved IPs) **and** `assertEgressAllowed()` (DNS resolution, rejecting hostnames that resolve to loopback, RFC1918, CGNAT, link-local/cloud metadata, multicast and reserved ranges).
- `safeFetch()` follows redirects manually and re-validates **every hop**, so an attacker-controlled `Location:` header cannot reach internal services.
- Applied to: full audit, sitemap audit, property autofill, SEO visibility report, site crawl, heading audit, image audit (including image HEAD/GET probes and sitemap/robots discovery).
- Known limitation: DNS is resolved immediately before each request, but the runtime resolves again when connecting. A deliberately rebinding hostname could race that window; pinning the validated IP via a custom agent is the hardening step if hostile input is expected.

### Rate limiting & CSRF

- `src/middleware.ts` rate-limits all `/api/*` traffic per client IP: 240 reads/min, 30 writes/min, 10/min for crawl/audit endpoints. Limits are per server instance; use a shared store for hard global quotas.
- State-changing API requests with a mismatched `Origin` are rejected (`403`).
- Responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP and (in production) HSTS. `/api/*` and `/platform` are `noindex`.

### Host process execution

- No request handler executes a shell string. Optional local bridges are **off by default** and only run through `execFile` with argument arrays:
  - `COGWHEEL_ALLOW_LOCAL_MAIL_CLI=1` + `COGWHEEL_MAIL_CLI_PATH` for the desktop Gmail CLI.
  - `COGWHEEL_ALLOW_LOCAL_PYTHON=1` for the python-pptx report builder.
- Serverless deployments never have these binaries, and the routes return an explicit `501` instead of attempting execution.

### Data integrity

- Synthetic demo data (GSC rows, keyword volumes, backlink profiles, AI citations) is gated behind `ALLOW_SIMULATED_DATA=1` and is **off by default**. Engines return empty results with `dataAvailable: false` rather than plausible numbers.
- Reports carry `dataProvenance` metadata describing what was measured, what was unavailable, and how the GEO score is derived (an on-page readiness heuristic, not an AI-engine citation measurement).
