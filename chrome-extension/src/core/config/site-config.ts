export type SiteType =
  | "hospitality"
  | "ecommerce"
  | "saas"
  | "local_business"
  | "editorial"
  | "corporate"
  | "general";

export type EngineMode = "auto" | "hospitality" | "universal";

export interface SiteConfig {
  siteType: SiteType;
  brandName: string;
  domain: string;
  locale: string;
  targetAudience: string;
  primaryKeywords: string[];
  competitors: string[];
  mode: EngineMode;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  config: SiteConfig;
}

const VALID_SITE_TYPES: ReadonlySet<SiteType> = new Set([
  "hospitality",
  "ecommerce",
  "saas",
  "local_business",
  "editorial",
  "corporate",
  "general",
]);

const VALID_MODES: ReadonlySet<EngineMode> = new Set(["auto", "hospitality", "universal"]);

export function createDefaultSiteConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    siteType: overrides.siteType && VALID_SITE_TYPES.has(overrides.siteType) ? overrides.siteType : "general",
    brandName: (overrides.brandName || "Website Brand").trim(),
    domain: (overrides.domain || "example.com").trim(),
    locale: (overrides.locale || "en-US").trim(),
    targetAudience: (overrides.targetAudience || "Online visitors and prospective customers").trim(),
    primaryKeywords: Array.isArray(overrides.primaryKeywords)
      ? overrides.primaryKeywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    competitors: Array.isArray(overrides.competitors)
      ? overrides.competitors.map((c) => String(c).trim()).filter(Boolean)
      : [],
    mode: overrides.mode && VALID_MODES.has(overrides.mode) ? overrides.mode : "auto",
  };
}

export function validateSiteConfig(raw: unknown): ConfigValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      errors: ["Configuration must be a JSON object."],
      config: createDefaultSiteConfig(),
    };
  }

  const obj = raw as Record<string, unknown>;
  const siteType = obj.siteType as SiteType | undefined;
  if (!siteType || !VALID_SITE_TYPES.has(siteType)) {
    errors.push(`Invalid or missing siteType: ${String(obj.siteType ?? "")}`);
  }

  if (typeof obj.brandName !== "string" || !obj.brandName.trim()) {
    errors.push("brandName must be a non-empty string.");
  }

  if (typeof obj.domain !== "string" || !obj.domain.trim()) {
    errors.push("domain must be a non-empty string.");
  }

  const mode = (obj.mode as EngineMode | undefined) ?? "auto";
  if (!VALID_MODES.has(mode)) {
    errors.push(`Invalid mode: ${String(obj.mode)}`);
  }

  const config = createDefaultSiteConfig({
    siteType: siteType && VALID_SITE_TYPES.has(siteType) ? siteType : "general",
    brandName: typeof obj.brandName === "string" ? obj.brandName : undefined,
    domain: typeof obj.domain === "string" ? obj.domain : undefined,
    locale: typeof obj.locale === "string" ? obj.locale : undefined,
    targetAudience: typeof obj.targetAudience === "string" ? obj.targetAudience : undefined,
    primaryKeywords: Array.isArray(obj.primaryKeywords) ? obj.primaryKeywords.map(String) : undefined,
    competitors: Array.isArray(obj.competitors) ? obj.competitors.map(String) : undefined,
    mode: VALID_MODES.has(mode) ? mode : "auto",
  });

  return {
    valid: errors.length === 0,
    errors,
    config,
  };
}
