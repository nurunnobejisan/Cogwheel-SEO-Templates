# Testing Guide

How SEO Studio's test suites work, how to run them locally, and what CI enforces on every pull request.

## Quick start

```bash
npm ci            # install Node dependencies (Node 20+)
pip install -r requirements.txt   # install Python dependencies (3.11+)
npm test          # the main suite — fastest signal
```

## Test suites at a glance

| Suite | Command | Runner | What it covers |
| --- | --- | --- | --- |
| Unit / integration | `npm test` | Vitest | Everything under `tests/**/*.test.ts` except the node:test files below, plus `src/tasks/**/*.test.ts` |
| SEO engine tests | `npm run test:seo` | `node:test` | 11 SEO engine suites (hotel SEO, SERP optimizer, exporters, variable resolver, …) **plus** the 10-gate SEO integrity linter |
| TypeScript integration | `npm run test:ts` | `node:test` | `tests/ts/*.test.ts` — zod schemas, XSS escaping, pixel truncation, edge cases & defenses |
| SEO integrity linter | `npm run lint:seo` | tsx | 10 content gates (structure, headings, images, links, schema, …) |
| Python analyzer tests | `pytest tests/python -q` | pytest | Analyzer, generators, ML pipeline stages, Pydantic models |
| Training-data governance | `npm run train:validate` | mixed | Dataset validation, ML example checks, golden-set freeze, source export check, dataset cards |
| Brain provenance gate | `npm run brain:eval data/brain-gold.example.json` | tsx | Asserts fabrication rate is 0 on the gold brain file |

> **Why the split?** Vitest and `node:test` both run TypeScript, but a handful of legacy suites and `tests/ts/` are executed by `node:test` explicitly. The Vitest config (`vitest.config.ts`) **excludes** those files so nothing runs twice. If you add a file to `tests/ts/`, it is picked up automatically by `npm run test:ts`, not by `npm test`.

## Running the suites

### Vitest (main suite)

```bash
npm test                          # full run
npx vitest run tests/packs-registry.test.ts   # single file
npx vitest watch tests/           # watch mode while developing
```

Tests live in `tests/` next to their fixtures (`tests/fixtures/`) and golden data (`tests/e2e/`). Name them `<subject>.test.ts`.

### node:test suites

```bash
npm run test:ts      # TypeScript integration tests (tests/ts/*.test.ts)
npm run test:seo     # SEO engine tests + SEO integrity linter
npm run lint:seo     # linter only
```

### Python

```bash
pip install -r requirements.txt
pytest tests/python -q            # whole Python suite
pytest tests/python/test_ml_train.py -q   # single file
```

CI installs with `pip install -r requirements.txt` and runs `pytest tests/python -q`.

### Full local reproduction of CI

Run these in order — this is exactly what the `Node · TypeScript · Next.js` job runs:

```bash
npm run typecheck
npm run lint
npm run train:validate
npm test
npm run lint:seo
npm run test:seo
npm run test:ts
npm run brain:eval data/brain-gold.example.json
npm run build
```

## Git hooks (husky)

Commits are guarded locally by `.husky/pre-commit` — six checks, any failure blocks the commit:

1. **Secret scan** — rejects `ghp_*`, `sk-*`, `AIza*` patterns in the source tree.
2. **Root typecheck** — `tsc --noEmit`.
3. **Chrome extension typecheck** — `tsc --noEmit` inside `chrome-extension/` when present.
4. **ESLint** — `eslint src/ tests/` (zero-`any` policy).
5. **SEO integrity linter** — `tsx tests/ts/seoLinter.ts` (10 gates).
6. **Schema validation** — `python3 -m python.scripts.validate_schemas`.

`.husky/commit-msg` enforces [Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <subject>` where type is one of
`feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert`.
Merge commits are exempt.

Bypass hooks only when you have a reason to (`git commit --no-verify`) — CI re-runs the
same checks regardless.

## CI pipeline (`.github/workflows/ci.yml`)

Every PR must pass all three jobs:

| Job | Steps |
| --- | --- |
| **Node · TypeScript · Next.js** | `npm ci` → typecheck → lint → `train:validate` → `npm test` → `lint:seo` → `test:seo` → `test:ts` → `brain:eval` → `next build` |
| **Python · Analyzer & Generators** | `pip install -r requirements.txt` → `pytest tests/python -q` |
| **Secret scan** | greps `src/ validators/ schemas/ exporters/ api/ python/` for token and private-key patterns |

A green local run of [Full local reproduction of CI](#full-local-reproduction-of-ci) plus
`pytest tests/python -q` means the PR will be green.

## Adding tests — conventions

- **Placement:** `tests/<subject>.test.ts` (Vitest), `tests/ts/<subject>.test.ts` (node:test), `tests/python/test_<subject>.py` (pytest).
- **Fixtures:** HTML pages and payloads go in `tests/fixtures/`; never point tests at live sites.
- **Isolation:** tests must not mutate files outside `tests/` and must not require network access — CI runs offline apart from package installs.
- **No sleeping:** use fake timers or inject clocks; flaky timing fails CI eventually.
- **Coverage expectations:** new behavior in `src/` lands with tests in the same PR. The backlog registry (`docs/TASKS.md`) marks each task's done-criterion, and most are test-defined.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Vitest picks up a file you expected `node:test` to run | Check the `exclude` list in `vitest.config.ts` — files listed there run via `npm run test:seo` instead. |
| `test:seo` fails but `npm test` passes | The SEO linter and engine suites are separate gates; run `npm run lint:seo` to see the failing gate by name. |
| Pre-commit blocked your commit | Read which of the six checks failed (step number in the output), fix, re-stage, commit again. |
| `brain:eval` fails with a fabrication rate > 0 | A claim in `data/brain-gold.example.json` lost its provenance anchor — restore the source citation, don't raise the threshold. |
| Python tests fail only locally | Confirm `pip install -r requirements.txt` matches CI's Python version (3.11+). |
