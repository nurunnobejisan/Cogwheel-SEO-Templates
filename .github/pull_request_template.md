## Description
<!-- Provide a brief description of the changes introduced by this pull request. -->

## Type of Change
<!-- Mark the relevant option with an [x]. -->
- [ ] `feat`: A new feature, audit engine, or template
- [ ] `fix`: A bug fix or schema correction
- [ ] `docs`: Documentation updates or additions
- [ ] `style`: Visual UI styling, design tokens, or dark mode
- [ ] `refactor`: Code refactoring without behavioral changes
- [ ] `perf`: Performance improvement (build time, bundle size, crawl speed)
- [ ] `test`: Unit, integration, or schema test additions
- [ ] `ci`: GitHub Actions workflow or build configuration changes
- [ ] `chore`: Dependency updates, tooling, or repository maintenance

## Affected Subsystems
- [ ] Next.js Studio Dashboard (`src/app/`, `src/components/`)
- [ ] Universal Chrome Extension MV3 (`chrome-extension/`)
- [ ] Unified AI Engine & Model Orchestrator (`src/engine/`)
- [ ] Python Suite & Serverless Functions (`python/`, `scripts/python/`, `outputs/`)
- [ ] Schemas & Data Models (`schemas/`, `src/types/`, `python/models/`)
- [ ] CMS Exporters & Adapters (`exporters/`, `validators/`)

## Single Source of Truth & Type Safety Checklist
<!-- Verify that all strict typing and schema rules are respected. -->
- [ ] **Single Source of Truth**: All data structure changes originate in `/schemas/*.schema.json`.
- [ ] **TypeScript / Zod**: Matching Zod schemas created in `src/types/` using `.strict()` with zero `any` types.
- [ ] **Python / Pydantic v2**: Matching Pydantic v2 models created in `python/models/` using `ConfigDict(extra="forbid", strict=True)`.
- [ ] **Zero `any` Types**: `eslint src/ tests/` passes with zero errors and no `@ts-ignore` / `@ts-expect-error`.

## Empirical Verification
<!-- Run all local verification steps before opening the PR. -->
- [ ] Root TypeScript type check passed: `npm run typecheck`
- [ ] Extension TypeScript type check passed: `cd chrome-extension && npx tsc --noEmit`
- [ ] ESLint passed cleanly: `npx eslint src/ tests/`
- [ ] SEO 10-Gate Linter passed: `npm run lint:seo`
- [ ] TypeScript & Node test suite passed: `npm run test:seo`
- [ ] Python test suite passed: `python3 tests/python/run_tests.py`
- [ ] Schema validation passed: `python3 scripts/python/validate_schemas.py`
- [ ] Production build passed: `npm run build`

## Secret Scanning & Guardrails
- [ ] No API keys, credentials, or client secrets committed.
- [ ] `.env*` files excluded from git staging.
