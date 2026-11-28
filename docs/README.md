# Documentation Index

Full map of SEO Studio's documentation. Start here, then follow the links
below to the specific area you need.

## Start here

| Document | Description |
| --- | --- |
| [README](../README.md) | Project overview, quick start, commands, and configuration |
| [Project structure](PROJECT_STRUCTURE.md) | Where every directory and file lives |
| [Architecture](ARCHITECTURE.md) | System topology, extension runtime, platform, and data contracts |
| [Technical specification](SPEC.md) | Detailed behavior and interfaces |

## Working on the code

| Document | Description |
| --- | --- |
| [Testing](TESTING.md) | Test suites, husky hooks, CI gates, and local CI reproduction |
| [API reference](API_REFERENCE.md) | Every HTTP route, auth mechanisms, and error shape |
| [Backlog & task registry](TASKS.md) | The task list with done-criteria and status |
| [Progress log](PROGRESS.md) | Master run history — what landed and when |
| [Engineering standards](GEMINI.md) | Engineering and standards rules for contributors |

## Feature guides

| Document | Description |
| --- | --- |
| [Vertical packs](PACKS.md) | How to author a custom vertical pack |
| [Universal mode](UNIVERSAL_MODE.md) | Non-hospitality sites and CMS-agnostic audits |
| [CMS integrations](CMS_INTEGRATIONS.md) | WordPress, Shopify, Webflow, and HTML adapters |
| [Self-healing pipeline](SELF_HEALING_PIPELINE.md) | Patch generation, review, and application |
| [AI SEO brain](AI_SEO_BRAIN.md) | Agents, tools, routing, and RAG |
| [Brain](BRAIN.md) | SEO Studio brain overview |
| [Reporting](REPORTING.md) | HTML/PDF/CSV/PPTX export behavior and provenance |
| [Platform runtime](PLATFORM_RUNTIME.md) | Operator console, durable storage, approvals |
| [SEO expert guide](SEO_EXPERT_GUIDE.md) | Operator workflow |

## Data & governance

| Document | Description |
| --- | --- |
| [Security](SECURITY.md) | Security policy, private reporting process, and supported versions |
| [Outcomes](OUTCOMES.md) | Outcome logging |
| [Judgment](JUDGMENT.md) | L2 judgment — effect estimates from outcomes |
| [Attribution](ATTRIBUTION.md) | Source code attribution and license inventory |
| [Inventory](INVENTORY.md) | Comprehensive file inventory |
| [Repository audit](REPOSITORY_AUDIT.md) | Findings, remediation status, and known limitations |
| [Roadmap](ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md) | Phases and remaining work |

## Worked example: what an llms.txt check reports

This is an invented example. `www.example.com` is not a real audited site, and the numbers below
describe only the sample file, not traffic, rankings or AI citations.

Suppose `https://www.example.com/llms.txt` answers HTTP 200 with this body (102 bytes):

```md
# Example Co

We sell example things.

## Docs
- [Guide](https://www.example.com/guide): How it works
```

`validateLlmsTxt` in `rules/geo/llms-txt.ts` reads it and reports status `present`, HTTP status
200 and a score of 86. Each check passes or fails on its own:

| Check | Result | Detail |
| --- | --- | --- |
| Starts with an H1 project name | pass | `Example Co` |
| Includes a blockquote summary | **fail** | `No '> summary' line found` |
| Has at least one `##` section | pass | `1 section heading(s)` |
| Contains at least one absolute http(s) link | pass | `1 valid of 1 Markdown link(s)` |
| Is plain Markdown, not an HTML page | pass | `No HTML document markers` |
| Under 512 KB | pass | `102 bytes` |
| No template placeholders | pass | `No placeholders found` |

The one failure is the summary: the line `We sell example things.` is plain text, and the check
looks for a line that starts with `> `. Changing it to `> We sell example things.` makes that check
pass.

When the file is missing (HTTP 404 or 410) the check reports status `absent` with a score of 0, and
the GEO audit adds the issue `geo-llms-txt-missing` ("Publish /llms.txt").
