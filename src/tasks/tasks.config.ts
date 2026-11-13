export type TaskSection = "On Page" | "Technical" | "Off Page" | "Local" | "Reporting";

export type TaskOutputType = "doc" | "sheet" | "xlsx" | "pptx" | "docx" | "json";

export type TaskStatus = "Not started" | "Running" | "Done" | "Flagged";

export type TaskDataSource =
  | "property"
  | "crawl"
  | "semrush"
  | "gsc"
  | "gbp"
  | "ahrefs"
  | "prior_runs"
  | "manual_notes";

export interface TaskConfig {
  id: string;
  section: TaskSection;
  name: string;
  /** Environment variable key holding the Google Drive/Docs/Sheets/Slides template ID (if applicable). */
  templateId: string;
  outputType: TaskOutputType;
  dataSources: TaskDataSource[];
  dependsOn: string[];
  phase: 1 | 2 | 3;
  status: TaskStatus;
  description: string;
}

export const TASK_SECTIONS: TaskSection[] = [
  "On Page",
  "Technical",
  "Off Page",
  "Local",
  "Reporting",
];

export const TASKS_CONFIG: TaskConfig[] = [
  // ── On Page ─────────────────────────────────────────────────────────────────
  {
    id: "seo-baseline-ai-visibility",
    section: "On Page",
    name: "SEO Baseline & AI Visibility",
    templateId: "GOOGLE_TEMPLATE_BASELINE_DOC_ID",
    outputType: "pptx",
    dataSources: ["property", "crawl", "semrush", "gsc"],
    dependsOn: [],
    phase: 2,
    status: "Done",
    description: "Capture initial organic search and AI visibility baseline metrics into a Google Slides deck.",
  },
  {
    id: "keyword-research",
    section: "On Page",
    name: "Keyword Research",
    templateId: "GOOGLE_TEMPLATE_DOC_ID_A",
    outputType: "doc",
    dataSources: ["property", "crawl", "semrush", "gsc"],
    dependsOn: [],
    phase: 1,
    status: "Done",
    description: "Ingest keyword exports, allocate 78-keyword pool, match pages, and generate Keyword Report Doc.",
  },
  {
    id: "compsets-keywords-analysis",
    section: "On Page",
    name: "Compsets Keywords Analysis",
    templateId: "GOOGLE_TEMPLATE_COMPSET_KW_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "semrush"],
    dependsOn: ["keyword-research"],
    phase: 2,
    status: "Not started",
    description: "Compare property keyword footprint and gaps against competitive set hotels.",
  },
  {
    id: "keyword-ranking-report-comp-set",
    section: "On Page",
    name: "Keyword Ranking Report update for comp set",
    templateId: "GOOGLE_TEMPLATE_COMPSET_RANK_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "semrush", "prior_runs"],
    dependsOn: ["compsets-keywords-analysis"],
    phase: 2,
    status: "Not started",
    description: "Update tracked keyword rankings across the property and comp set domains.",
  },
  {
    id: "title-meta",
    section: "On Page",
    name: "Title_Meta Description",
    templateId: "GOOGLE_TEMPLATE_DOC_ID_TITLE_META",
    outputType: "doc",
    dataSources: ["property", "crawl", "prior_runs"],
    dependsOn: ["site-crawl", "keyword-research"],
    phase: 1,
    status: "Done",
    description: "Draft SEO-optimized title tags and meta descriptions mapped to approved primary keywords.",
  },
  {
    id: "usp-headline-optimization",
    section: "On Page",
    name: "USP and Headline Optimization",
    templateId: "GOOGLE_HILTON_TEMPLATE_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "crawl", "prior_runs", "manual_notes"],
    dependsOn: ["keyword-research"],
    phase: 1,
    status: "Done",
    description: "Hilton Content Studio: strict diff-mode copy, character limits, USPs, ADA/JS rules, and Google Doc.",
  },
  {
    id: "heading-structure",
    section: "On Page",
    name: "Heading Structure Optimization",
    templateId: "GOOGLE_TEMPLATE_SHEET_ID_HEADINGS",
    outputType: "sheet",
    dataSources: ["property", "crawl", "prior_runs"],
    dependsOn: ["site-crawl", "keyword-research"],
    phase: 1,
    status: "Done",
    description: "Audit and recommend H1-H3 hierarchy aligned with target keywords per page.",
  },
  {
    id: "image-optimization",
    section: "On Page",
    name: "Image Optimization",
    templateId: "GOOGLE_TEMPLATE_IMAGE_OPT_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "crawl", "prior_runs"],
    dependsOn: ["keyword-research"],
    phase: 2,
    status: "Not started",
    description: "Audit image alt text, filenames, and compression opportunities across active pages.",
  },

  // ── Technical ───────────────────────────────────────────────────────────────
  {
    id: "site-crawl",
    section: "Technical",
    name: "Site Crawl",
    templateId: "GOOGLE_TEMPLATE_TECH_AUDIT_SHEET_ID",
    outputType: "json",
    dataSources: ["property", "crawl"],
    dependsOn: [],
    phase: 1,
    status: "Done",
    description: "Crawl property URL respecting robots.txt and sitemap.xml, storing per-page and site-wide facts.",
  },
  {
    id: "technical-audit",
    section: "Technical",
    name: "Technical Audit",
    templateId: "GOOGLE_TEMPLATE_TECH_AUDIT_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "crawl", "gsc"],
    dependsOn: [],
    phase: 2,
    status: "Not started",
    description: "Crawlability, indexation, status codes, canonicals, and Core Web Vitals audit.",
  },
  {
    id: "sitemap-navigation-optimization",
    section: "Technical",
    name: "Sitemap & Navigation Optimization",
    templateId: "GOOGLE_TEMPLATE_SITEMAP_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "crawl", "prior_runs"],
    dependsOn: ["technical-audit"],
    phase: 2,
    status: "Not started",
    description: "Evaluate XML sitemap coverage and internal navigation architecture.",
  },
  {
    id: "duplicate-content-audit",
    section: "Technical",
    name: "Duplicate Content Audit",
    templateId: "GOOGLE_TEMPLATE_DUPLICATE_CONTENT_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "crawl"],
    dependsOn: ["technical-audit"],
    phase: 2,
    status: "Not started",
    description: "Identify duplicate titles, meta descriptions, thin pages, and canonical conflicts.",
  },
  {
    id: "schema-markup",
    section: "Technical",
    name: "Schema Markup",
    templateId: "GOOGLE_TEMPLATE_SCHEMA_DOC_ID",
    outputType: "json",
    dataSources: ["property", "crawl"],
    dependsOn: [],
    phase: 2,
    status: "Not started",
    description: "Generate grounded Hotel, LodgingBusiness, Restaurant, and FAQPage JSON-LD markup.",
  },
  {
    id: "site-tech-re-audit-report",
    section: "Technical",
    name: "Site Tech Re-Audit Report",
    templateId: "GOOGLE_TEMPLATE_TECH_REAUDIT_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "crawl", "gsc", "prior_runs"],
    dependsOn: ["technical-audit"],
    phase: 3,
    status: "Not started",
    description: "Re-audit technical health against the initial Technical Audit baseline.",
  },

  // ── Off Page ────────────────────────────────────────────────────────────────
  {
    id: "internal-kickoff-strategy-list",
    section: "Off Page",
    name: "Internal Kickoff & Strategy List Creation",
    templateId: "GOOGLE_TEMPLATE_OFFPAGE_KICKOFF_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "crawl", "manual_notes"],
    dependsOn: [],
    phase: 2,
    status: "Not started",
    description: "Build initial off-page target list, local PR angles, and linkable property assets.",
  },
  {
    id: "email-outreach-formatting",
    section: "Off Page",
    name: "Email Outreach Formatting",
    templateId: "GOOGLE_TEMPLATE_OUTREACH_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "prior_runs"],
    dependsOn: ["internal-kickoff-strategy-list"],
    phase: 2,
    status: "Not started",
    description: "Draft grounded outreach email templates tailored to hospitality partners and local media.",
  },
  {
    id: "competitors-backlink-analysis",
    section: "Off Page",
    name: "Competitors Backlink Analysis",
    templateId: "GOOGLE_TEMPLATE_BACKLINK_COMP_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "semrush", "ahrefs"],
    dependsOn: [],
    phase: 2,
    status: "Not started",
    description: "Analyze competitor referring domains and identify replicable hospitality link opportunities.",
  },
  {
    id: "backlinking-strategy-execution",
    section: "Off Page",
    name: "Backlinking Strategy & Execution",
    templateId: "GOOGLE_TEMPLATE_BACKLINK_STRATEGY_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "prior_runs"],
    dependsOn: ["competitors-backlink-analysis", "internal-kickoff-strategy-list"],
    phase: 3,
    status: "Not started",
    description: "Consolidate backlink targets, outreach status, and execution roadmap.",
  },

  // ── Local ───────────────────────────────────────────────────────────────────
  {
    id: "google-map-citation",
    section: "Local",
    name: "Google Map Citation",
    templateId: "GOOGLE_TEMPLATE_LOCAL_CITATION_SHEET_ID",
    outputType: "sheet",
    dataSources: ["property", "gbp", "crawl"],
    dependsOn: [],
    phase: 2,
    status: "Not started",
    description: "Audit NAP consistency, Google Business Profile categories, and local directory citations.",
  },

  // ── Reporting ───────────────────────────────────────────────────────────────
  {
    id: "seo-only-visibility-report",
    section: "Reporting",
    name: "SEO Only Visibility Report (monthly)",
    templateId: "GOOGLE_TEMPLATE_MONTHLY_VISIBILITY_PPTX_ID",
    outputType: "pptx",
    dataSources: ["property", "semrush", "gsc", "crawl", "prior_runs"],
    dependsOn: ["keyword-research"],
    phase: 3,
    status: "Done",
    description: "Monthly SEO visibility deck covering tracked rankings, ancillary keywords, and site health.",
  },
  {
    id: "ai-seo-visibility-report",
    section: "Reporting",
    name: "AI & SEO Visibility Report (quarterly)",
    templateId: "GOOGLE_TEMPLATE_QUARTERLY_AI_SEO_PPTX_ID",
    outputType: "pptx",
    dataSources: ["property", "semrush", "gsc", "prior_runs"],
    dependsOn: ["seo-baseline-ai-visibility", "seo-only-visibility-report"],
    phase: 3,
    status: "Not started",
    description: "Quarterly executive deck combining organic SEO trends and AI/GEO visibility performance.",
  },
  {
    id: "final-seo-geo-project-report",
    section: "Reporting",
    name: "Final SEO/GEO Project Report",
    templateId: "GOOGLE_TEMPLATE_FINAL_REPORT_DOC_ID",
    outputType: "doc",
    dataSources: ["property", "prior_runs"],
    dependsOn: ["keyword-research", "usp-headline-optimization", "site-tech-re-audit-report"],
    phase: 3,
    status: "Not started",
    description: "End-of-engagement summary compiling all deliverables, wins, and outstanding flags.",
  },
];

export const TASK_BY_ID: Record<string, TaskConfig> = Object.fromEntries(
  TASKS_CONFIG.map((t) => [t.id, t]),
);

export function getTaskConfig(taskId: string): TaskConfig | undefined {
  return TASK_BY_ID[taskId];
}

export function getTasksBySection(section: TaskSection): TaskConfig[] {
  return TASKS_CONFIG.filter((t) => t.section === section);
}

