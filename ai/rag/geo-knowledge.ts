/**
 * GEO knowledge chunks.
 *
 * Curated, citable notes from the GEO paper and our own playbooks. These are
 * ingested alongside the seed knowledge base and the repository corpus. Each
 * chunk has an id the brain can cite, plus a real source URL where one exists.
 */

import type { RagChunk } from "../types.ts";

export const GEO_KNOWLEDGE: RagChunk[] = [
  {
    id: "geo-paper-visibility",
    title: "GEO paper: what improves generative-engine visibility",
    text:
      "The GEO paper (Aggarwal et al., KDD 2024, arXiv:2311.09735) studied how content changes affect visibility in generative engines. It introduced GEO-bench, a 10,000-query benchmark, and reported that some optimization methods improved visibility by up to roughly 40% relative. The methods studied include citing sources, adding quotations, adding statistics, and improving fluency or clarity. Keyword stuffing did not help. GEO visibility is not the same as a traditional ranking: an engine may mention or cite a source without a blue link.",
    source: "GEO: Generative Engine Optimization (KDD 2024)",
    url: "https://arxiv.org/abs/2311.09735",
    tags: ["geo", "research", "visibility", "citations"],
  },
  {
    id: "geo-paper-methods",
    title: "GEO method families: citations, quotations, statistics, fluency",
    text:
      "The GEO paper groups effective optimizations into four families: (1) cite sources so claims have verifiable origins; (2) add quotations from named people or documents; (3) add statistics with units and dates; (4) improve fluency and easy-to-understand wording. It also tested low-quality keyword stuffing, which performed poorly. For our engine, these families become the citability components and content recommendations. We cite the paper's findings rather than claiming we measured the same percentages.",
    source: "GEO: Generative Engine Optimization (KDD 2024)",
    url: "https://arxiv.org/abs/2311.09735",
    tags: ["geo", "research", "citability", "content"],
  },
  {
    id: "geo-bench-queries",
    title: "GEO-bench: 10,000 generative-engine queries",
    text:
      "GEO-bench contains 10,000 queries repurposed for generative engines, assembled from nine real-world and synthetic sources. Queries are categorised by target domain, difficulty, and intent. Our gold set borrows the idea of prompt-style queries but is hand-verified by humans. We do not generate gold labels with a model, and we do not train on third-party benchmark code.",
    source: "GEO-bench (Hugging Face)",
    url: "https://huggingface.co/datasets/GEO-Optim/geo-bench",
    tags: ["geo", "research", "evals", "prompts"],
  },
  {
    id: "geo-playbook-llms-txt",
    title: "llms.txt: structure and validation rules",
    text:
      "llms.txt is a Markdown file published at the site root (/llms.txt). A valid file starts with an H1 project name, includes a one-line blockquote summary, and adds ## sections whose link lists point to the most citable pages. Links should be absolute http(s) URLs. The file should be plain Markdown, not an HTML page, and should stay well under 512 KB. Our validator checks the H1, summary, sections, absolute links, plain-text format, size, and placeholders. Missing (HTTP 404) is reported as absent; a fetch failure is reported as unavailable.",
    source: "llmstxt.org + Cogwheel GEO playbook",
    url: "https://llmstxt.org/",
    tags: ["geo", "llms-txt", "technical", "playbook"],
  },
  {
    id: "geo-playbook-ai-crawlers",
    title: "AI crawler access in robots.txt",
    text:
      "AI answer engines use crawlers such as GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, Bytespider, and meta-externalagent. A User-agent group with 'Disallow: /' blocks that crawler; an explicit Allow rule can override a broader Disallow. If no group matches a crawler, it is unmentioned rather than blocked. A 404 robots.txt means access is unrestricted by default. We never infer crawler access when robots.txt could not be fetched.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "robots", "crawlers", "technical", "playbook"],
  },
  {
    id: "geo-playbook-citability",
    title: "Citability score formula and components",
    text:
      "Our citability score is a deterministic 0-100 heuristic, labelled estimated, not an AI-citation measurement. Formula: round(structured_data × 0.25 + answer_coverage × 0.25 + entity_signals × 0.15 + content_depth × 0.15 + citations × 0.20). Structured data rewards schema types, FAQPage and entity schema. Answer coverage rewards question-style headings and direct answer blocks. Entity signals reward Organization/LocalBusiness schema, sameAs links and NAP. Content depth uses word bands and paragraph count. Citations count statistics, quotations, external links and years. Every component exposes its inputs.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "citability", "score", "formula", "playbook"],
  },
  {
    id: "geo-playbook-drift",
    title: "GEO drift detection and CI threshold",
    text:
      "A GEO snapshot stores the citability score, component scores, llms.txt status, robots status, blocked AI crawlers, schema types, word count and issue ids. Drift compares the newest snapshot with the previous one. The default CI fail threshold is a 5-point citability drop. A newly blocked AI crawler, a lost llms.txt, removed schema types, or a large word-count loss also fails the check. Snapshots are local-first and can be exported as CI artifacts.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "drift", "ci", "monitoring", "playbook"],
  },
  {
    id: "geo-playbook-visibility-tracking",
    title: "AI visibility tracking: mentions and citations",
    text:
      "Visibility tracking asks a fixed set of buyer prompts to each configured provider and records whether the brand was mentioned and which domains were cited. Mention matching is deterministic text matching, not an LLM judge. Citation classification covers own, competitor, social, informational and other. Competitor domains must be supplied by the operator; we never guess competitors. A prompt where every provider was unavailable is unmeasured, not a gap. A prompt is a gap only when at least one provider answered and none mentioned the brand.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "visibility", "mentions", "citations", "playbook"],
  },
  {
    id: "geo-playbook-provider-keys",
    title: "BYOK provider adapters and daily cost caps",
    text:
      "Provider adapters are enabled only when their API key exists: OPENAI_API_KEY for ChatGPT, ANTHROPIC_API_KEY for Claude, PERPLEXITY_API_KEY for Perplexity, and GEMINI_API_KEY or GOOGLE_AI_API_KEY for Gemini. Google AI Overviews has no official API, so that adapter always reports unavailable rather than scraping. Every provider call is checked against VISIBILITY_DAILY_CALL_CAP (default 60) and VISIBILITY_DAILY_COST_CAP_USD (default 3). When a cap is reached the adapter returns unavailable with the cap reason.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "providers", "byok", "cost", "playbook"],
  },
  {
    id: "geo-playbook-answer-blocks",
    title: "Answer blocks and question-led headings",
    text:
      "A citable page gives a direct answer before the detail. Use question-style H2 or H3 headings that match how buyers ask the question, then a 40-60 word factual answer, then supporting sections. Add cited statistics or quotations with source links. Do not invent numbers: if a figure is not measured or sourced, leave it out. FAQPage or QAPage schema can make the Q&A structure explicit.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "content", "answer-blocks", "headings", "playbook"],
  },
  {
    id: "geo-playbook-entity-signals",
    title: "Entity signals for AI recognition",
    text:
      "Answer engines need to resolve the brand as an entity. Use consistent Organization, LocalBusiness, Hotel or LodgingBusiness JSON-LD with name, url, logo, sameAs and NAP. Align the same facts across the site, Google Business Profile and Wikidata. Brand mentions in the title and meta description help, but schema and third-party corroboration matter more. Never fabricate awards, ratings or review counts.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "entity", "schema", "brand", "playbook"],
  },
  {
    id: "geo-playbook-measurement-policy",
    title: "Measure, label, or leave blank",
    text:
      "Every metric carries a provenance label. Measured means it came from a live fetch or a connected data source. Estimated means a documented deterministic heuristic, such as citability. Unavailable means the source needed to measure it is not connected; the value is null, never a plausible placeholder. For visibility tracking, mentioned=false means an answer was measured and the brand was absent; mentioned=null means no answer was measured. Rankings, search volumes, citations, competitors, fees and revenue are never invented.",
    source: "Cogwheel measurement policy",
    tags: ["geo", "policy", "provenance", "measurement"],
  },
  {
    id: "geo-playbook-training-data",
    title: "Training data tiers and LoRA export gate",
    text:
      "Training triples move through raw, reviewed and gold tiers. Capture requires consent, a robots.txt allow decision, PII stripping and deduplication. Only reviewed and gold triples are training-eligible. The LoRA export is JSONL and refuses to start training until at least 2,000 reviewed pairs exist. Training data is our own audit-to-expert-fix pairs; third-party repository code is never training data.",
    source: "Cogwheel GEO playbook",
    tags: ["geo", "training", "lora", "tiers", "playbook"],
  },
  {
    id: "geo-tool-review-elmo",
    title: "Elmo: open-source AI visibility tracking",
    text:
      "elmohq/elmo is an MIT-licensed, self-hosted AI visibility platform tracking mentions and citations across ChatGPT, Claude, Perplexity, Gemini and AI Overviews. We reuse the product shape (prompt sets, per-engine capture, share-of-voice denominators) and write our own adapters and store. We do not vendor the platform or use an LLM judge for mention detection.",
    source: "docs/research/geo-tools-review.md",
    url: "https://github.com/elmohq/elmo",
    tags: ["geo", "tools", "research", "visibility"],
  },
  {
    id: "geo-tool-review-geoready",
    title: "GeoReady GEO Optimizer: readiness and drift checks",
    text:
      "Auriti-Labs/geo-optimizer-skill (GeoReady) is MIT-licensed and provides llms.txt and AI-crawler checks, a 0-100 citability score, score versioning and drift detection. Our implementation adapts the check taxonomy and writes deterministic TypeScript with visible formulas. We skip the CLI, SQLite store and hosted product. GPL-licensed gego was rejected for code reuse.",
    source: "docs/research/geo-tools-review.md",
    url: "https://github.com/Auriti-Labs/geo-optimizer-skill",
    tags: ["geo", "tools", "research", "citability", "drift"],
  },
  {
    id: "geo-tool-review-limelit",
    title: "Limelit Open: deterministic mention and citation rules",
    text:
      "limelit-co/open is Apache-2.0 and pre-release. It uses text search rather than an LLM to match brand and competitor mentions, classifies citation sources, and excludes branded prompts from some denominators. Our gap detector follows the same honesty rule: unmeasured prompts are separate from absent-brand gaps. No Go code or SQLite store is vendored.",
    source: "docs/research/geo-tools-review.md",
    url: "https://github.com/limelit-co/open",
    tags: ["geo", "tools", "research", "visibility", "citations"],
  },
];
