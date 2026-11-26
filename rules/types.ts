/**
 * SEO Studio Universal SEO Engine — Shared Rule Types
 *
 * Defines the mode-aware contract shared by the Hotel Mode ruleset (existing,
 * untouched) and the new Universal Mode ruleset. Hotel Mode and Universal Mode
 * coexist as parallel, non-blocking extensions of the same execution context.
 *
 * See docs/ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md (Phase 1).
 */

/** Execution context resolved per audited URL. */
export type AuditMode = "universal" | "hotel";

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";

/** The four universal evaluation pillars from the master roadmap. */
export type UniversalPillar = "metadata" | "content" | "media" | "technical";

export type IssueCategory = UniversalPillar | "accessibility" | "schema" | "hospitality";

export interface AuditIssueContext {
  /** The offending value as found on the page (empty string when absent). */
  currentValue: string | number | boolean | null;
  /** CSS selector or logical locator for the affected node. */
  selector: string;
  /** Present only for image-related issues. */
  imageSrc?: string;
  /** Short, machine-actionable instruction for the auto-fix engine. */
  recommendedAction: string;
}

/**
 * Normalized issue shape. This is the deterministic contract consumed by the
 * AI patch engine and the CMS deployment gateway.
 */
export interface AuditIssue {
  issueId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  /** Whether the CMS Auto-Fix engine is allowed to synthesize a patch. */
  fixable: boolean;
  /** CMS field the patch should target, or null when no direct field exists. */
  cmsTargetField: string | null;
  context: AuditIssueContext;
}

export interface HeadingEntry {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ImageAsset {
  src: string;
  alt: string | null;
  /** Intrinsic (declared/actual) pixel width. */
  width: number | null;
  height: number | null;
  /** Rendered width/height in CSS pixels, when the extractor can measure it. */
  renderedWidth?: number | null;
  renderedHeight?: number | null;
  /** Lower-cased file extension when known, e.g. "jpg", "webp". */
  format?: string | null;
  loading?: string | null;
}

export interface LinkEntry {
  href: string;
  text?: string;
  external: boolean;
  rel?: string | null;
  /** HTTP status observed by the crawler, when available. */
  statusCode?: number | null;
  /** Intermediate hops observed before the final URL. */
  redirectChain?: string[];
}

export interface JsonLdNode {
  "@type"?: string | string[];
  [key: string]: unknown;
}

export interface OpenGraphTags {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
  type?: string | null;
}

export interface TwitterTags {
  card?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/**
 * The single normalized input every rule evaluates against. Produced by the
 * extension's controlled DOM extraction pass (see captureFullRenderedDOM) or by
 * the lightweight HTML snapshot fallback in rules/html-snapshot.ts.
 */
export interface PageSnapshot {
  url: string;
  hostname: string;
  title: string;
  metaDescription: string;
  canonical: string | null;
  metaRobots: string | null;
  language: string | null;
  headings: HeadingEntry[];
  images: ImageAsset[];
  links: LinkEntry[];
  wordCount: number;
  textContent: string;
  jsonLd: JsonLdNode[];
  /** Script `src` values, used for booking-engine signature detection. */
  scriptSrcs: string[];
  openGraph: OpenGraphTags;
  twitter: TwitterTags;
  hasViewport: boolean;
  /** DOM presence of reservation widgets / booking date pickers. */
  reservationWidgets: boolean;
  fetchStatus?: number | null;
}

export interface RuleContext {
  snapshot: PageSnapshot;
  mode: AuditMode;
  /** ISO timestamp for deterministic tests. */
  now: string;
}

export interface AuditRule {
  id: string;
  pillar: IssueCategory;
  description: string;
  evaluate(ctx: RuleContext): AuditIssue[];
}

export interface ModeDetection {
  mode: AuditMode;
  /** 0..1 confidence derived from the weight of matched hotel signals. */
  confidence: number;
  /** Human-readable trigger descriptions, e.g. "jsonld:Hotel". */
  signals: string[];
  /** True when a manual per-domain override decided the mode. */
  overridden: boolean;
}

export interface AuditSummary {
  totalIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  byCategory: Partial<Record<IssueCategory, number>>;
  /** 0..100 health score derived from issue severity weights. */
  score: number;
}

/**
 * Standardized Universal Audit JSON payload. Mirrors the roadmap schema and is
 * validated by rules/schema.ts before leaving the engine.
 */
export interface AuditReport {
  auditId: string;
  domain: string;
  pageUrl: string;
  timestamp: string;
  mode: AuditMode;
  modeDetection: ModeDetection;
  issues: AuditIssue[];
  summary: AuditSummary;
}

export interface AuditOptions {
  /** Manual per-domain override store (localStorage / chrome.storage / memory). */
  overrideStore?: ModeOverrideStoreLike;
  auditId?: string;
  now?: string;
}

/** Minimal structural interface so any storage adapter can be injected. */
export interface ModeOverrideStoreLike {
  get(domain: string): AuditMode | null;
  set(domain: string, mode: AuditMode | null): void;
}
