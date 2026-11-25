import { PageAuditData } from "../../../types/extension";
import { SiteConfig, SiteType } from "../../../core/config/site-config";
import { parseTemplateWithFallbacks } from "../../../core/templates/template-engine";
import {
  buildUniversalTemplateVariables,
  renderBaseUniversalTemplates,
  UniversalTemplateSet,
} from "../templates/base-templates";

export interface UniversalAdapterOutput {
  adapterId: SiteType;
  recommendedSchemas: string[];
  recommendations: string[];
  templates: UniversalTemplateSet;
}

export interface UniversalVerticalAdapter {
  id: SiteType;
  recommendedSchemas: string[];
  buildRecommendations: (config: SiteConfig, pageData: Partial<PageAuditData>) => string[];
  overrideTemplates?: (
    base: UniversalTemplateSet,
    config: SiteConfig,
    pageData: Partial<PageAuditData>
  ) => UniversalTemplateSet;
}

const ecommerceAdapter: UniversalVerticalAdapter = {
  id: "ecommerce",
  recommendedSchemas: ["Product", "Offer", "BreadcrumbList", "Organization"],
  buildRecommendations: (config, pageData) => {
    const recs: string[] = [];
    if (!pageData.ecommerce?.price) {
      recs.push(`Add Offer price and availability markup for ${config.brandName} product pages.`);
    }
    if ((pageData.imagesWithoutAlt || 0) > 0) {
      recs.push(`Add descriptive SKU/product alt text to ${pageData.imagesWithoutAlt} product images.`);
    }
    recs.push("Include shipping, return policy, and aggregateRating in Product JSON-LD for shopping & AI citations.");
    return recs;
  },
  overrideTemplates: (base, config, pageData) => {
    const vars = {
      ...buildUniversalTemplateVariables(config, pageData),
      productName: pageData.ecommerce?.productName || pageData.h1Elements?.[0] || config.primaryKeywords[0],
      price: pageData.ecommerce?.price || "Best available price",
    };
    return {
      ...base,
      metaTitle: parseTemplateWithFallbacks(
        `Shop {{productName | fallback: "Featured Products"}} | {{brandName | fallback: "Store"}}`,
        vars
      ).rendered,
      metaDescription: parseTemplateWithFallbacks(
        `Buy {{productName | fallback: "quality products"}} at {{brandName | fallback: "our store"}}. {{price | fallback: "Fast shipping"}} for {{targetAudience | fallback: "online shoppers"}}.`,
        vars
      ).rendered,
    };
  },
};

const saasAdapter: UniversalVerticalAdapter = {
  id: "saas",
  recommendedSchemas: ["SoftwareApplication", "FAQPage", "Organization", "BreadcrumbList"],
  buildRecommendations: (config, pageData) => {
    const recs: string[] = [];
    if ((pageData.words || 0) < 500) {
      recs.push(`Expand feature & workflow copy for ${config.brandName} to >= 500 words for AI/LLM citation depth.`);
    }
    recs.push("Add SoftwareApplication + FAQPage JSON-LD covering pricing tiers, integrations, and security compliance.");
    return recs;
  },
  overrideTemplates: (base, config, pageData) => {
    const vars = buildUniversalTemplateVariables(config, pageData);
    return {
      ...base,
      metaTitle: parseTemplateWithFallbacks(
        `{{primaryTopic | fallback: "Platform"}} — {{primaryKeyword | fallback: "Cloud Software"}} | {{brandName | fallback: "SaaS"}}`,
        vars
      ).rendered,
      metaDescription: parseTemplateWithFallbacks(
        `{{brandName | fallback: "Our platform"}} helps {{targetAudience | fallback: "teams"}} streamline {{primaryKeyword | fallback: "workflows"}}. Start a free trial or book a demo today.`,
        vars
      ).rendered,
    };
  },
};

const localBusinessAdapter: UniversalVerticalAdapter = {
  id: "local_business",
  recommendedSchemas: ["LocalBusiness", "PostalAddress", "FAQPage", "BreadcrumbList"],
  buildRecommendations: (_config, pageData) => {
    const recs: string[] = [];
    if (!pageData.detectedNap?.phone || !pageData.detectedNap?.address) {
      recs.push("Ensure consistent Name, Address, and Phone (NAP) are visible in HTML and LocalBusiness JSON-LD.");
    }
    recs.push("Add service-area geo-modifiers and openingHoursSpecification for Google Local Pack & AI answers.");
    return recs;
  },
};

const editorialAdapter: UniversalVerticalAdapter = {
  id: "editorial",
  recommendedSchemas: ["Article", "Person", "BreadcrumbList", "Organization"],
  buildRecommendations: (_config, pageData) => {
    const recs: string[] = [];
    if ((pageData.h2Elements?.length || 0) < 2) {
      recs.push("Structure long-form article with clear H2/H3 section headings for featured snippets and LLM extraction.");
    }
    recs.push("Include author byline, datePublished, and dateModified in Article JSON-LD for E-E-A-T trust.");
    return recs;
  },
};

const corporateAdapter: UniversalVerticalAdapter = {
  id: "corporate",
  recommendedSchemas: ["Organization", "WebSite", "WebPage", "BreadcrumbList"],
  buildRecommendations: () => [
    "Verify Organization sameAs social/authority links and clear executive entity positioning.",
  ],
};

const generalAdapter: UniversalVerticalAdapter = {
  id: "general",
  recommendedSchemas: ["WebPage", "Organization", "BreadcrumbList"],
  buildRecommendations: (_config, pageData) => {
    const recs: string[] = [];
    if (!pageData.canonical) {
      recs.push("Add a self-referencing rel=canonical link tag to prevent duplicate indexing.");
    }
    recs.push("Ensure a single descriptive H1, >= 450 words of structured copy, and JSON-LD entity markup.");
    return recs;
  },
};

const ADAPTERS: Record<SiteType, UniversalVerticalAdapter> = {
  ecommerce: ecommerceAdapter,
  saas: saasAdapter,
  local_business: localBusinessAdapter,
  editorial: editorialAdapter,
  corporate: corporateAdapter,
  general: generalAdapter,
  hospitality: generalAdapter, // Hospitality uses dedicated Hospitality Engine when routed
};

export function runUniversalAdapter(
  siteType: SiteType,
  config: SiteConfig,
  pageData: Partial<PageAuditData>
): UniversalAdapterOutput {
  const effectiveConfig: SiteConfig = { ...config, siteType };
  const adapter = ADAPTERS[siteType] || generalAdapter;
  const baseTemplates = renderBaseUniversalTemplates(effectiveConfig, pageData);
  const templates = adapter.overrideTemplates
    ? adapter.overrideTemplates(baseTemplates, effectiveConfig, pageData)
    : baseTemplates;

  return {
    adapterId: adapter.id,
    recommendedSchemas: adapter.recommendedSchemas,
    recommendations: adapter.buildRecommendations(effectiveConfig, pageData),
    templates,
  };
}
