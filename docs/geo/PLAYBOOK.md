# GEO playbook

This is our own operating playbook. It is deliberately conservative: every
recommendation is either measured, labelled as an estimate, or omitted.

## 1. Crawl access first

Checks (measured from live `robots.txt`):

- `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`
- `ClaudeBot`, `anthropic-ai`, `Claude-Web`
- `PerplexityBot`, `Perplexity-User`
- `Google-Extended`, `Applebot-Extended`
- `CCBot`, `Bytespider`, `meta-externalagent`

A `User-agent` group with `Disallow: /` blocks the crawler. A specific group
overrides the `*` group. An explicit `Allow` can override a broader `Disallow`
(longest match wins; `Allow` wins ties). If `robots.txt` is missing (404),
crawlers are unrestricted by default. If it cannot be fetched, the check is
`unavailable`; we do not assume access.

## 2. Publish /llms.txt

A valid `llms.txt` is Markdown at the site root:

```markdown
# Example Hotel

> A 120-room boutique hotel in downtown Denver.

## Rooms

- [Rooms and suites](https://example.com/rooms)
- [Accessibility](https://example.com/accessibility)
```

Rules: H1 project name, one-line blockquote summary, `##` sections, absolute
http(s) links, plain Markdown, under 512 KB, no placeholders.

## 3. Improve citability

Citability is a 0–100 `estimated` score:

```
round(structured_data×0.25 + answer_coverage×0.25 + entity_signals×0.15
    + content_depth×0.15 + citations×0.20)
```

Priorities when the score is low:

1. Add `Organization` / `LocalBusiness` / `Hotel` JSON-LD with `name`, `url`,
   `logo`, `sameAs`, `telephone`, `address`.
2. Add `FAQPage` or `QAPage` where there are real questions and answers.
3. Rewrite key H2s as buyer questions and put a 40–60 word answer directly
   below each one.
4. Add cited statistics, quotations, and source links. Never invent figures.

## 4. Track drift

Each audit stores a snapshot. A 5-point citability drop fails the CI gate.
Newly blocked crawlers, a lost `llms.txt`, removed schema types, and a large
word-count loss also fail.

```bash
npm run geo:drift -- baseline.json current.json --threshold 5
```

## 5. Measure AI visibility

- Generate buyer prompts in hotel or universal mode.
- Ask each configured provider (BYOK) and store mention/citation results.
- `mentioned: false` means measured absence; `mentioned: null` means the
  provider was unavailable.
- Gaps require at least one real answer. Unmeasured prompts are listed
  separately.
- Gap fixes become `pending_approval` plans in `healing/`; nothing is applied
  automatically.

## 6. Never fabricate

Never state rankings, search volumes, AI citations, competitor names, fees,
revenue, or benchmark scores without a measured source. "Unavailable" is a
valid, expected result.
