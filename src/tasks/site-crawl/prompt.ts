/**
 * `site-crawl` is a deterministic data-collection task and intentionally makes
 * no Claude calls. This marker satisfies the shared module file contract.
 */
export const NO_CLAUDE_PROMPT_REASON =
  "site-crawl performs deterministic HTTP crawling and HTML extraction only (no LLM draft)." as const;

