export type UniversalSiteCategory =
  | "hospitality"
  | "ecommerce"
  | "editorial"
  | "saas"
  | "local_business"
  | "corporate"
  | "general";

export type DetectedCms =
  | "WordPress/Yoast"
  | "WordPress/RankMath"
  | "WordPress/Classic"
  | "Shopify"
  | "Webflow"
  | "Squarespace"
  | "Wix"
  | "Ghost"
  | "Next.js"
  | "Generic/DOM";

export interface DetailedImageItem {
  id: string;
  src: string;
  alt: string;
  proposedAlt: string;
  targetFilename: string;
  isDecorative: boolean;
  width?: number | null;
  height?: number | null;
  loading?: string;
  format: string;
  issues: string[];
  priority: "High" | "Medium" | "Good";
  placementIndex: number;
}

export interface HeadingHierarchyItem {
  tag: "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
  text: string;
  level: number;
  isMissing?: boolean;
  isSkippedLevel?: boolean;
  isMultipleH1?: boolean;
  isEmpty?: boolean;
  isTooLong?: boolean;
  suggestedTitleCase?: string;
}

export interface UniversalEcommerceData {
  isEcommerce: boolean;
  productName?: string;
  price?: string;
  currency?: string;
  availability?: string;
  sku?: string;
}

export interface CoreWebVitalsAudit {
  clsRiskCount: number;
  lcpLazyDelayCount: number;
  oversizedCount: number;
  legacyFormatCount: number;
  estimatedSavingsKb: number;
}

export interface PageAuditData {
  url: string;
  origin: string;
  pathname: string;
  protocol: string;
  hostname: string;
  title: string;
  titlePixelWidth?: number;
  metaDesc: string;
  metaDescPixelWidth?: number;
  metaRobots?: string;
  language?: string;
  canonical: string;
  siteCategory?: UniversalSiteCategory;
  siteCategoryLabel?: string;
  detectedCms?: DetectedCms;
  detectedCmsLabel?: string;
  h1Elements: string[];
  h2Elements: string[];
  h3Elements: string[];
  allHeadings?: Array<{ tag: string; text: string }>;
  headingHierarchy?: HeadingHierarchyItem[];
  headingIssues?: string[];
  totalImages: number;
  imagesWithoutAlt: number;
  oversizedImages: number;
  imagesList?: Array<{ src: string; alt: string; loading?: string }>;
  detailedImages?: DetailedImageItem[];
  vitals?: CoreWebVitalsAudit;
  ecommerce?: UniversalEcommerceData;
  words: number;
  extractedAmenities?: string[];
  topKeywords?: Array<{ term: string; count: number; density: string }>;
  schemas: any[];
  links: {
    internal: number;
    external: number;
    nofollow: number;
  };
  internalUrls?: string[];
  hasViewport: boolean;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTags?: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
  };
  detectedNap?: {
    phone?: string;
    address?: string;
    email?: string;
  };
  socialLinks?: Array<{ platform: string; url: string }>;
  loadTimeMs?: number;
}

export interface ScoreBreakdown {
  overall: number; // 0 - 100
  onPage: number; // 0 - 100
  schemaTechnical: number; // 0 - 100
  geoAiReadiness: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "NEEDS AUDIT";
  gradeColor: string;
  passedGates: number;
  totalGates: number;
  quickWins: QuickWinItem[];
}

export interface QuickWinItem {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  impact: string;
  templateIdToFix?: string;
  fixActionLabel?: string;
}

export interface CogwheelTemplate {
  id: string;
  title: string;
  category: "Landing Pages" | "Schemas" | "Meta & Headings" | "AI Prompts" | "Audits & Checklists" | "CMS Exporters";
  format: "html" | "json" | "markdown" | "txt";
  description: string;
  tags: string[];
  content: string;
  defaultVariables: Record<string, string>;
  isFavorite?: boolean;
}

export interface ClientProfile {
  id: string;
  name: string;
  brand: string;
  domain: string;
  city: string;
  state: string;
  primaryKeywords: string[];
  usps: string[];
  phone: string;
  address: string;
  postalCode: string;
  startingRate?: string;
}

export interface OverlayToggles {
  headings: boolean;
  missingAlts: boolean;
  links: boolean;
  schemaTree: boolean;
}

export interface CmsAutoFillResult {
  detectedCms: "WordPress/Yoast" | "WordPress/RankMath" | "WordPress/Classic" | "Webflow" | "Shopify" | "Generic/DOM";
  filledFields: string[];
  success: boolean;
}
