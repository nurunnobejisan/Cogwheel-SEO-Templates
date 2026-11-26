/**
 * llms.txt presence and validity.
 *
 * Spec reference: https://llmstxt.org/ — a Markdown file with an H1 project
 * name, an optional blockquote summary, and `##` sections containing link
 * lists. This validator is intentionally conservative: it reports exactly the
 * checks it ran and never guesses at content that was not fetched.
 */

import type { CheckDetail, LlmsTxtCheck } from "./types.ts";

export interface LlmsTxtInput {
  url: string;
  /** HTTP status, or null when the request failed / was skipped. */
  statusCode: number | null;
  text?: string | null;
  error?: string;
}

const MAX_LLMS_BYTES = 512_000;

function countMarkdownLinks(text: string): { total: number; valid: number } {
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  let valid = 0;
  for (const match of links) {
    const href = match[1] ?? "";
    try {
      const parsed = new URL(href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") valid += 1;
    } catch {
      // Relative links are legal Markdown but not valid in a published
      // llms.txt, whose links should resolve for an external crawler.
    }
  }
  return { total: links.length, valid };
}

export function validateLlmsTxt(input: LlmsTxtInput): LlmsTxtCheck {
  const base: LlmsTxtCheck = {
    id: "llms_txt",
    label: "llms.txt",
    provenance: "measured",
    url: input.url,
    status: "unavailable",
    httpStatus: input.statusCode,
    score: null,
    checks: [],
    parsed: null,
    reason: input.error,
  };

  if (input.error || input.statusCode === null) {
    return { ...base, reason: input.error ?? "No response from llms.txt" };
  }

  if (input.statusCode === 404 || input.statusCode === 410) {
    return {
      ...base,
      status: "absent",
      score: 0,
      reason: `HTTP ${input.statusCode} — no llms.txt published`,
    };
  }

  if (input.statusCode < 200 || input.statusCode >= 300) {
    return {
      ...base,
      status: "unavailable",
      reason: `HTTP ${input.statusCode} — could not read llms.txt`,
    };
  }

  const text = (input.text ?? "").replace(/^\uFEFF/, "");
  const bytes = Buffer.byteLength(text, "utf8");
  const lines = text.split(/\r?\n/);
  const firstContent = lines.find((line) => line.trim().length > 0) ?? "";
  const titleMatch = /^#\s+(.+)$/.exec(firstContent.trim());
  const summaryLine = lines.find((line) => /^\s*>\s+/.test(line)) ?? null;
  const sections = [...text.matchAll(/^##\s+\S+/gm)];
  const links = countMarkdownLinks(text);
  const lower = text.toLowerCase();

  const checks: CheckDetail[] = [
    {
      id: "h1_title",
      label: "Starts with an H1 project name",
      pass: Boolean(titleMatch),
      detail: titleMatch ? titleMatch[1].trim() : "First non-empty line is not an H1",
    },
    {
      id: "summary",
      label: "Includes a blockquote summary",
      pass: Boolean(summaryLine),
      detail: summaryLine ? summaryLine.trim().slice(0, 160) : "No '> summary' line found",
    },
    {
      id: "sections",
      label: "Has at least one ## section",
      pass: sections.length > 0,
      detail: `${sections.length} section heading(s)`,
    },
    {
      id: "links",
      label: "Contains at least one absolute http(s) link",
      pass: links.valid > 0,
      detail: `${links.valid} valid of ${links.total} Markdown link(s)`,
    },
    {
      id: "plain_text",
      label: "Is plain Markdown, not an HTML page",
      pass: !/<(!doctype|html|head|body)\b/i.test(lower),
      detail: /<(!doctype|html|head|body)\b/i.test(lower) ? "HTML markup detected" : "No HTML document markers",
    },
    {
      id: "size",
      label: `Under ${Math.round(MAX_LLMS_BYTES / 1000)} KB`,
      pass: bytes <= MAX_LLMS_BYTES,
      detail: `${bytes} bytes`,
    },
    {
      id: "no_placeholders",
      label: "No template placeholders",
      pass: !/\{\{[^}]*\}\}|lorem ipsum|TODO:|FIXME:/i.test(text),
      detail: /\{\{[^}]*\}\}|lorem ipsum|TODO:|FIXME:/i.test(text) ? "Placeholder text found" : "No placeholders found",
    },
  ];

  const passed = checks.filter((check) => check.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  const requiredValid =
    Boolean(titleMatch) && sections.length > 0 && links.valid > 0 && checks.find((c) => c.id === "plain_text")!.pass;

  return {
    ...base,
    status: requiredValid ? "present" : "invalid",
    score,
    checks,
    parsed: {
      title: titleMatch ? titleMatch[1].trim() : null,
      summary: summaryLine ? summaryLine.replace(/^\s*>\s?/, "").trim() : null,
      sectionCount: sections.length,
      linkCount: links.valid,
      bytes,
    },
  };
}
