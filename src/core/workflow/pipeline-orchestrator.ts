import type { Property } from "@/lib/types";

export type PipelineStepStatus = "pending" | "in_progress" | "requires_approval" | "completed" | "flagged" | "failed";

export interface PipelineStep {
  stepNumber: number;
  id: string;
  title: string;
  phase: "Onboarding & Discovery" | "Keyword Strategy" | "Deep SEO & Content" | "Growth & Competitors" | "Execution & Governance" | "Reporting & Deliverables";
  description: string;
  assignedAgentId?: string;
  associatedTaskId?: string;
  status: PipelineStepStatus;
  requiresHumanApproval: boolean;
  completedAt?: string;
  resultSummary?: string;
}

export const UNIFIED_26_STEP_PIPELINE: PipelineStep[] = [
  // Phase 1: Onboarding & Discovery
  {
    stepNumber: 1,
    id: "step-create-client",
    title: "Create Client",
    phase: "Onboarding & Discovery",
    description: "Initialize client organization profile with industry tags and contact records.",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 2,
    id: "step-create-property",
    title: "Create Hotel Property",
    phase: "Onboarding & Discovery",
    description: "Configure hotel property details, brand guidelines, and home market geo modifiers.",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 3,
    id: "step-submit-website-url",
    title: "Submit Website URL",
    phase: "Onboarding & Discovery",
    description: "Validate target domain, enforce HTTPS protocol, and execute SSRF safety pre-flight.",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 4,
    id: "step-crawl-website",
    title: "Crawl Website",
    phase: "Onboarding & Discovery",
    description: "Crawl target hotel website within bounds, recording raw HTTP facts and DOM landmarks.",
    assignedAgentId: "agent-website-audit",
    associatedTaskId: "site-crawl",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 5,
    id: "step-discover-sitemap",
    title: "Discover Sitemap Pages",
    phase: "Onboarding & Discovery",
    description: "Inspect robots.txt, parse XML sitemaps, and catalogue active hotel page types.",
    assignedAgentId: "agent-website-audit",
    associatedTaskId: "sitemap-navigation-optimization",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 6,
    id: "step-validate-property-info",
    title: "Validate Property Information",
    phase: "Onboarding & Discovery",
    description: "Verify hotel address, phone, amenities, and room categories against extracted site facts.",
    assignedAgentId: "agent-qa-verification",
    status: "completed",
    requiresHumanApproval: true,
  },

  // Phase 2: Keyword Strategy
  {
    stepNumber: 7,
    id: "step-import-keyword-data",
    title: "Import Keyword Data",
    phase: "Keyword Strategy",
    description: "Ingest Semrush/CSV exports, clean KD values, apply volume floor, and strip wrong geo modifiers.",
    assignedAgentId: "agent-keyword-research",
    associatedTaskId: "keyword-research",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 8,
    id: "step-analyze-keyword-opps",
    title: "Analyze Keyword Opportunities",
    phase: "Keyword Strategy",
    description: "Identify high-volume demand generators and low-competition local venue search terms.",
    assignedAgentId: "agent-keyword-research",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 9,
    id: "step-cluster-keywords",
    title: "Cluster Keywords",
    phase: "Keyword Strategy",
    description: "Sort cleaned keyword universe into brand, local, dining, wedding, meeting, and amenity buckets.",
    assignedAgentId: "agent-keyword-research",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 10,
    id: "step-generate-keyword-pool",
    title: "Generate Keyword Pool",
    phase: "Keyword Strategy",
    description: "Deterministically allocate the standard 78-keyword pool with primary/secondary/fill/reserve roles.",
    assignedAgentId: "agent-keyword-research",
    associatedTaskId: "keyword-research",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 11,
    id: "step-map-keywords-to-urls",
    title: "Map Keywords to URLs",
    phase: "Keyword Strategy",
    description: "Match primary keywords to eligible sitemap page paths, respecting the KD < 45 limit.",
    assignedAgentId: "agent-keyword-mapping",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 12,
    id: "step-review-approve-mappings",
    title: "Review & Approve Mappings",
    phase: "Keyword Strategy",
    description: "Checkpoint approval matrix allowing SEO strategists to swap roles or approve KD exceptions.",
    status: "completed",
    requiresHumanApproval: true,
  },

  // Phase 3: Deep SEO & Content
  {
    stepNumber: 13,
    id: "step-run-on-page-analysis",
    title: "Run On-Page Analysis",
    phase: "Deep SEO & Content",
    description: "Audit page title tags, meta descriptions, and H1-H3 heading hierarchies against mapped keywords.",
    assignedAgentId: "agent-on-page-seo",
    associatedTaskId: "title-meta",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 14,
    id: "step-run-technical-seo-audit",
    title: "Run Technical SEO Audit",
    phase: "Deep SEO & Content",
    description: "Inspect HTTP status codes, redirect chains, canonical consistency, and Core Web Vitals.",
    assignedAgentId: "agent-technical-seo",
    associatedTaskId: "technical-audit",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 15,
    id: "step-run-local-seo-audit",
    title: "Run Local SEO Audit",
    phase: "Deep SEO & Content",
    description: "Audit Name, Address, Phone (NAP) consistency across directories and GBP category hierarchy.",
    assignedAgentId: "agent-local-seo",
    associatedTaskId: "google-map-citation",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 16,
    id: "step-generate-content-recs",
    title: "Generate Content Recommendations",
    phase: "Deep SEO & Content",
    description: "Author Hilton-compliant diff mode copy with exact character limits, USPs, and ADA claims.",
    assignedAgentId: "agent-content-optimization",
    associatedTaskId: "usp-headline-optimization",
    status: "completed",
    requiresHumanApproval: true,
  },
  {
    stepNumber: 17,
    id: "step-generate-schema-recs",
    title: "Generate Schema Recommendations",
    phase: "Deep SEO & Content",
    description: "Generate grounded Hotel, LodgingBusiness, Restaurant, and FAQPage Schema.org JSON-LD.",
    assignedAgentId: "agent-schema-validation",
    associatedTaskId: "schema-markup",
    status: "completed",
    requiresHumanApproval: false,
  },

  // Phase 4: Growth & Competitors
  {
    stepNumber: 18,
    id: "step-run-competitor-analysis",
    title: "Run Competitor Analysis",
    phase: "Growth & Competitors",
    description: "Benchmark keyword rankings, share of voice, and revenue query gaps against compset hotels.",
    assignedAgentId: "agent-competitor-analysis",
    associatedTaskId: "compsets-keywords-analysis",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 19,
    id: "step-analyze-backlink-data",
    title: "Analyze Backlink Data",
    phase: "Growth & Competitors",
    description: "Identify referring domain gaps and build an authoritative 90-day PR link acquisition roadmap.",
    assignedAgentId: "agent-backlink-analysis",
    associatedTaskId: "competitors-backlink-analysis",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 20,
    id: "step-run-geo-research",
    title: "Run GEO Research",
    phase: "Growth & Competitors",
    description: "Track brand recommendation and direct citation rates across ChatGPT, Perplexity, and AI Overviews.",
    assignedAgentId: "agent-geo-research",
    associatedTaskId: "ai-seo-visibility-report",
    status: "completed",
    requiresHumanApproval: false,
  },

  // Phase 5: Execution & Governance
  {
    stepNumber: 21,
    id: "step-generate-tasks",
    title: "Generate Tasks",
    phase: "Execution & Governance",
    description: "Convert all audit findings into actionable engineering and editorial tickets with priorities.",
    assignedAgentId: "agent-qa-verification",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 22,
    id: "step-assign-team-members",
    title: "Assign Team Members",
    phase: "Execution & Governance",
    description: "Assign responsible specialists (Technical, On-Page, Off-Page, Content) with due dates.",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 23,
    id: "step-track-implementation",
    title: "Track Implementation",
    phase: "Execution & Governance",
    description: "Track sprint ticket statuses from In Progress through Under Review to Approved.",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 24,
    id: "step-recheck-completed-tasks",
    title: "Recheck Completed Tasks",
    phase: "Execution & Governance",
    description: "Re-crawl site and verify defect resolutions against the initial technical baseline.",
    assignedAgentId: "agent-technical-seo",
    associatedTaskId: "site-tech-re-audit-report",
    status: "completed",
    requiresHumanApproval: false,
  },

  // Phase 6: Reporting & Deliverables
  {
    stepNumber: 25,
    id: "step-generate-performance-reports",
    title: "Generate Performance Reports",
    phase: "Reporting & Deliverables",
    description: "Render monthly SEO Visibility PPTX and quarterly AI/GEO executive presentations.",
    assignedAgentId: "agent-reporting",
    associatedTaskId: "seo-only-visibility-report",
    status: "completed",
    requiresHumanApproval: false,
  },
  {
    stepNumber: 26,
    id: "step-export-client-deliverables",
    title: "Export Client Deliverables",
    phase: "Reporting & Deliverables",
    description: "Compile and export final deliverables in PPTX, PDF, HTML5, WordPress, Shopify, and Webflow.",
    assignedAgentId: "agent-reporting",
    associatedTaskId: "final-seo-geo-project-report",
    status: "completed",
    requiresHumanApproval: true,
  },
];

export interface PipelineExecutionState {
  property: Property;
  currentStepIndex: number;
  totalSteps: number;
  completedStepsCount: number;
  isPaused: boolean;
  steps: PipelineStep[];
  startedAt: string;
  updatedAt: string;
}

export function initializePipeline(property: Property): PipelineExecutionState {
  return {
    property,
    currentStepIndex: 0,
    totalSteps: UNIFIED_26_STEP_PIPELINE.length,
    completedStepsCount: 0,
    isPaused: false,
    steps: UNIFIED_26_STEP_PIPELINE.map((s) => ({ ...s, status: "pending" })),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
