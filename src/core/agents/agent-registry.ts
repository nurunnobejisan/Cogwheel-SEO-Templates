export type AgentRole =
  | "Website Audit Agent"
  | "Keyword Research Agent"
  | "Keyword Mapping Agent"
  | "On-Page SEO Agent"
  | "Technical SEO Agent"
  | "Content Optimization Agent"
  | "Schema Validation Agent"
  | "Local SEO Agent"
  | "Competitor Analysis Agent"
  | "Backlink Analysis Agent"
  | "GEO Research Agent"
  | "Reporting Agent"
  | "Quality Assurance Agent";

export interface AgentDefinition {
  id: string;
  name: AgentRole;
  description: string;
  category: "Technical" | "Keywords" | "Content" | "Off-Page" | "Local" | "AI Search" | "Reporting" | "QA";
  requiredInputs: string[];
  outputDeliverable: string;
  associatedTaskId: string;
  systemPromptGoal: string;
}

export const ENTERPRISE_AI_AGENTS: AgentDefinition[] = [
  {
    id: "agent-website-audit",
    name: "Website Audit Agent",
    description: "Executes deep website crawl, inspects robots.txt, XML sitemaps, status codes, and indexability.",
    category: "Technical",
    requiredInputs: ["websiteUrl", "crawlDepth", "propertyProfile"],
    outputDeliverable: "Crawl Fact Inventory & Site Diagnostics",
    associatedTaskId: "site-crawl",
    systemPromptGoal: "Crawl target hotel website within bounds, recording raw HTTP facts and DOM landmarks without guessing.",
  },
  {
    id: "agent-keyword-research",
    name: "Keyword Research Agent",
    description: "Ingests Semrush/CSV exports, applies KD cleaners, volume floors, and deterministic 78-keyword allocation.",
    category: "Keywords",
    requiredInputs: ["rawKeywordFiles", "propertyProfile", "geoModifiers"],
    outputDeliverable: "78-Keyword Strategy Pool & Role Assignments",
    associatedTaskId: "keyword-research",
    systemPromptGoal: "Process multi-file keyword data with strict tie-breaking, volume floor preservation, and zero fabrication.",
  },
  {
    id: "agent-keyword-mapping",
    name: "Keyword Mapping Agent",
    description: "Maps allocated primary and secondary keywords to active sitemap pages with strict approval checkpoints.",
    category: "Keywords",
    requiredInputs: ["keywordPool", "sitemapPages"],
    outputDeliverable: "Page-to-Keyword Mapping Matrix with Exception Flags",
    associatedTaskId: "keyword-research",
    systemPromptGoal: "Assign highest-intent relevant keywords to eligible page buckets while enforcing the KD < 45 rule.",
  },
  {
    id: "agent-on-page-seo",
    name: "On-Page SEO Agent",
    description: "Drafts pixel-budgeted title tags (580px) and meta descriptions (920px) mapped to approved primary keywords.",
    category: "Content",
    requiredInputs: ["mappedKeywords", "pageHeadings", "brandRules"],
    outputDeliverable: "Title & Meta Recommendation Sheet with Physical SERP Bounds",
    associatedTaskId: "title-meta",
    systemPromptGoal: "Author high-CTR snippet copy strictly respecting physical pixel bounds and brand guardrails.",
  },
  {
    id: "agent-technical-seo",
    name: "Technical SEO Agent",
    description: "Audits redirect chains, canonical consistency, duplicate content, and Core Web Vitals performance.",
    category: "Technical",
    requiredInputs: ["crawledPages", "gscData"],
    outputDeliverable: "Prioritized Technical SEO Defect Log",
    associatedTaskId: "technical-audit",
    systemPromptGoal: "Identify critical crawlability, indexation, and performance bottlenecks with evidence-based fixes.",
  },
  {
    id: "agent-content-optimization",
    name: "Content Optimization Agent",
    description: "Enforces Hilton brand compliance, strict diff mode copy, ADA rules, and USP headline enhancements.",
    category: "Content",
    requiredInputs: ["existingPageCopy", "primaryKeyword", "brandGuidelines"],
    outputDeliverable: "Hilton-Approved Diff-Mode Copy Blocks",
    associatedTaskId: "usp-headline-optimization",
    systemPromptGoal: "Optimize hotel copy with strictly validated character limits, zero forbidden terms, and mandatory ADA claims.",
  },
  {
    id: "agent-schema-validation",
    name: "Schema Validation Agent",
    description: "Generates valid JSON-LD structured data for Hotel, LodgingBusiness, Restaurant, and FAQPage rich results.",
    category: "Technical",
    requiredInputs: ["hotelFacts", "amenities", "pageType"],
    outputDeliverable: "Schema.org @graph Multi-Entity JSON-LD Script",
    associatedTaskId: "schema-markup",
    systemPromptGoal: "Construct syntactically valid Schema.org graph trees using verified property facts without fake reviews.",
  },
  {
    id: "agent-local-seo",
    name: "Local SEO Agent",
    description: "Audits NAP consistency across top local directories and validates Google Business Profile categories.",
    category: "Local",
    requiredInputs: ["hotelAddress", "phone", "gbpCategories"],
    outputDeliverable: "Local Map Citation & NAP Discrepancy Audit",
    associatedTaskId: "google-map-citation",
    systemPromptGoal: "Verify business name, address, and phone across directories and optimize local category hierarchy.",
  },
  {
    id: "agent-competitor-analysis",
    name: "Competitor Analysis Agent",
    description: "Analyzes competitor keyword rankings, content coverage gaps, and share of voice in the local market.",
    category: "Keywords",
    requiredInputs: ["compsetDomains", "trackedKeywords"],
    outputDeliverable: "Competitive Set Ranking & Keyword Gap Matrix",
    associatedTaskId: "compsets-keywords-analysis",
    systemPromptGoal: "Quantify competitive market share, rank deltas, and missed revenue keyword opportunities.",
  },
  {
    id: "agent-backlink-analysis",
    name: "Backlink Analysis Agent",
    description: "Evaluates competitor referring domains and builds high-equity hospitality PR link acquisition pipelines.",
    category: "Off-Page",
    requiredInputs: ["backlinkProfiles", "linkableAssets"],
    outputDeliverable: "90-Day Backlink Sprint Roadmap & Outreach Targets",
    associatedTaskId: "competitors-backlink-analysis",
    systemPromptGoal: "Identify authoritative editorial, tourism board, and regional media link acquisition targets.",
  },
  {
    id: "agent-geo-research",
    name: "GEO Research Agent",
    description: "Monitors brand recommendations, direct citations, and competitor presence across AI search engines.",
    category: "AI Search",
    requiredInputs: ["testQueryPrompts", "geoObservations"],
    outputDeliverable: "Generative Engine Visibility & Citation Performance Scorecard",
    associatedTaskId: "ai-seo-visibility-report",
    systemPromptGoal: "Track brand inclusion, citation URLs, and sentiment in ChatGPT Search, Google AI Overviews, and Perplexity.",
  },
  {
    id: "agent-reporting",
    name: "Reporting Agent",
    description: "Generates client-ready monthly and quarterly executive presentations, deliverables, and CMS exports.",
    category: "Reporting",
    requiredInputs: ["auditFindings", "rankings", "geoMetrics"],
    outputDeliverable: "Executive PPTX Presentations, Final Engagement Deliverable & Multi-CMS Formats",
    associatedTaskId: "seo-only-visibility-report",
    systemPromptGoal: "Synthesize complex search intelligence into clear, concise executive decks and production export files.",
  },
  {
    id: "agent-qa-verification",
    name: "Quality Assurance Agent",
    description: "Validates all pipeline outputs against brand guardrails, character budgets, zero broken links, and SSOT schemas.",
    category: "QA",
    requiredInputs: ["draftOutput", "validationRules"],
    outputDeliverable: "Quality Assurance Pass/Fail Verdict & Automated Feedback",
    associatedTaskId: "site-tech-re-audit-report",
    systemPromptGoal: "Perform automated adversarial verification on all generated assets before client delivery.",
  },
];

export function getAgentById(id: string): AgentDefinition | undefined {
  return ENTERPRISE_AI_AGENTS.find((a) => a.id === id);
}

export function getAgentsByCategory(category: AgentDefinition["category"]): AgentDefinition[] {
  return ENTERPRISE_AI_AGENTS.filter((a) => a.category === category);
}
