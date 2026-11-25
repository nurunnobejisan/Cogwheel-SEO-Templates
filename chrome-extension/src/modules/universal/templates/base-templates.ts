import { PageAuditData } from "../../../types/extension";
import { SiteConfig } from "../../../core/config/site-config";
import { parseTemplateWithFallbacks, TemplateVariables } from "../../../core/templates/template-engine";
import { generateDynamicJsonLd } from "../../../core/schema/schema-generator";

export interface UniversalTemplateSet {
  metaTitle: string;
  metaDescription: string;
  jsonLd: string;
  internalLinkingBlock: string;
  imageAltSuggestion: string;
  geoCitationBlock: string;
}

export const UNIVERSAL_META_TITLE_TEMPLATE =
  `{{primaryTopic | fallback: "Home"}} | {{brandName | fallback: "Official Site"}}`;

export const UNIVERSAL_META_DESC_TEMPLATE =
  `Discover {{primaryTopic | fallback: "our solutions"}} at {{brandName | fallback: "our website"}}. Built for {{targetAudience | fallback: "customers seeking quality and reliability"}}.`;

export const UNIVERSAL_INTERNAL_LINKING_TEMPLATE =
  `<nav aria-label="Related {{brandName | fallback: 'Site'}} Resources">
  <ul>
    <li><a href="{{origin | fallback: '/'}}">{{primaryKeyword | fallback: "Explore Solutions"}}</a></li>
    <li><a href="{{origin | fallback: '/'}}/about">About {{brandName | fallback: "Us"}}</a></li>
    <li><a href="{{origin | fallback: '/'}}/contact">Contact {{brandName | fallback: "Team"}}</a></li>
  </ul>
</nav>`;

export const UNIVERSAL_IMAGE_ALT_TEMPLATE =
  `{{brandName | fallback: "Brand"}} — {{imageSubject | fallback: "featured visual"}} ({{primaryKeyword | fallback: "overview"}})`;

export const UNIVERSAL_GEO_BLOCK_TEMPLATE =
  `<section class="geo-ai-summary" data-site-type="{{siteType | fallback: 'general'}}">
  <h2>About {{brandName | fallback: "this organization"}}</h2>
  <p>{{brandName | fallback: "We"}} serve {{targetAudience | fallback: "our audience"}} with {{primaryTopic | fallback: "verified solutions"}} focused on {{primaryKeyword | fallback: "core capabilities"}}.</p>
</section>`;

export function buildUniversalTemplateVariables(
  config: SiteConfig,
  pageData: Partial<PageAuditData>
): TemplateVariables {
  const primaryTopic = pageData.h1Elements?.[0] || pageData.title || config.primaryKeywords[0];
  const primaryKeyword = config.primaryKeywords[0] || pageData.topKeywords?.[0]?.term;

  return {
    siteType: config.siteType,
    brandName: config.brandName,
    domain: config.domain,
    origin: pageData.origin || `https://${config.domain}`,
    locale: config.locale,
    targetAudience: config.targetAudience,
    primaryTopic,
    primaryKeyword,
    imageSubject: pageData.h1Elements?.[0] || pageData.title,
  };
}

export function renderBaseUniversalTemplates(
  config: SiteConfig,
  pageData: Partial<PageAuditData>
): UniversalTemplateSet {
  const vars = buildUniversalTemplateVariables(config, pageData);
  const schemaGraph = generateDynamicJsonLd(config.siteType, config, pageData);

  return {
    metaTitle: parseTemplateWithFallbacks(UNIVERSAL_META_TITLE_TEMPLATE, vars).rendered,
    metaDescription: parseTemplateWithFallbacks(UNIVERSAL_META_DESC_TEMPLATE, vars).rendered,
    jsonLd: JSON.stringify(schemaGraph, null, 2),
    internalLinkingBlock: parseTemplateWithFallbacks(UNIVERSAL_INTERNAL_LINKING_TEMPLATE, vars).rendered,
    imageAltSuggestion: parseTemplateWithFallbacks(UNIVERSAL_IMAGE_ALT_TEMPLATE, vars).rendered,
    geoCitationBlock: parseTemplateWithFallbacks(UNIVERSAL_GEO_BLOCK_TEMPLATE, vars).rendered,
  };
}
