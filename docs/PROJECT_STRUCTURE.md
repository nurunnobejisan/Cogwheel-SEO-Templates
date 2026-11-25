# Project Structure Guide

> Canonical reference for where every file belongs in this repository.

## Directory Layout Principles

1. **Root stays clean** — Only standard config files (`package.json`, `tsconfig.json`, etc.) and community files (`README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`) live at the root.
2. **`docs/`** — All documentation, guides, audit reports, and architecture docs.
3. **`src/`** — All TypeScript source code (the Next.js app + Chrome extension core).
4. **`python/`** — All Python source code, organized by domain.
5. **`tests/`** — All test files, split into `ts/`, `python/`, `e2e/`, and `fixtures/`.
6. **`schemas/`** — Single source of truth for all JSON Schema and TS schema definitions.
7. **`scripts/`** — Build, CI, and automation scripts (TS, Python, shell).
8. **`templates/`** — SEO audit prompt templates.
9. **`data/`** — Static data files, training datasets, model registry.
10. **No duplicates** — Each file has exactly one canonical location.

## Where to Put New Files

| File Type | Location |
|-----------|----------|
| TypeScript source | `src/<module>/` |
| Python source | `python/<module>/` |
| JSON Schema | `schemas/` |
| TypeScript test | `tests/` or `tests/ts/` |
| Python test | `tests/python/` |
| E2E test | `tests/e2e/` |
| Test fixtures | `tests/fixtures/` |
| Documentation | `docs/` |
| Audit reports | `docs/audit/` |
| Build/CI scripts | `scripts/` |
| Python scripts | `python/scripts/` |
| SEO templates | `templates/` |
| CMS exporters | `exporters/` |
| SEO validators | `validators/` |
| Static data | `data/` |
| Generated output | `output/<domain>/` |
| Public assets | `public/` |
| DB migrations | `supabase/migrations/` |
| CI workflows | `.github/workflows/` |
| Issue templates | `.github/ISSUE_TEMPLATE/` |

## Maintenance Rules

- **Never add loose `.md` docs to the root** — put them in `docs/`.
- **Never duplicate files** across `python/` and `scripts/python/` — Python scripts go to `python/scripts/`.
- **Never add Python code to `outputs/`** — that folder was removed; use `python/generators/`.
- **Keep `shared/` empty** — schemas are consolidated in `schemas/`.
- **Run `npm run lint && npm test`** before committing to verify nothing broke.
