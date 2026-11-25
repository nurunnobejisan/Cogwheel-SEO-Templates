# Contributing to Cogwheel SEO

We welcome contributions! By participating in this project you agree to follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

1. **Fork the repository** and clone your fork locally.
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**. Keep the code style consistent – we run `npm run lint`
   as part of CI.
4. **Write tests** for new functionality (Vitest for TypeScript, Pytest for Python).
5. **Run the full test suite** locally:
   ```bash
   npm run typecheck && npm run lint && npm test
   npm run lint:seo && npm run test:seo && npm run test:ts
   pytest tests/python -q
   ```
6. **Commit with a clear message** and push to your fork.
7. **Open a Pull Request** targeting the `main` branch of the upstream repo.
   - Include a brief description of the change.
   - Reference any related issue (e.g., `Closes #12`).

## Review Process

- CI will automatically run linting, tests, and the build.
- A maintainer will review the PR, request changes if needed, and merge it once all checks pass.

## Development Scripts

- `npm run dev` – Starts the Next.js dev server (`next dev`).
- `npm run build` – Production build of the Next.js app (`next build`).
- `npm run build:extension` / `npm run extension:build` – Builds the Chrome extension.
- `npm run lint` – Runs ESLint via `next lint`.
- `npm run typecheck` – Runs `tsc --noEmit`.
- `npm test` – Runs the Vitest suite.
- `npm run lint:seo` – Runs the 10-gate SEO integrity linter.
- `npm run test:seo` / `npm run test:ts` – Runs the `node:test` integration suites.
- `pytest tests/python -q` – Runs Python unit tests.

## Code Style

- Use **Tailwind** utility classes for styling.
- Follow the **semantic‑HTML5** guidelines from `GEMINI.md`.
- Keep TypeScript types strict; avoid `any` where possible.

Happy hacking! 🎉
