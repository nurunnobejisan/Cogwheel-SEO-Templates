/**
 * One-click "Unified Packet" builder used by `AutomationBulkRunner`.
 *
 * Every variable is either sourced from the operator's client profile or from
 * the audited page, or it keeps the template's own `defaultVariables` — the
 * same sample text `TemplateStudio` previews. Nothing here invents copy: the
 * old builder shipped a hardcoded phone number, street address, star rating,
 * lat/long and FAQ answers as fallbacks, and left `{{...}}` tokens unresolved
 * in three of the five sections.
 */
import { SEO_STUDIO_TEMPLATES, resolveTemplateContent } from "../data/seoStudioTemplates";
import type { ClientProfile, PageAuditData, SeoStudioTemplate } from "../types/extension";

/** The five templates rendered into the packet, in section order. */
export const PACKET_TEMPLATE_IDS = [
  "title-meta-suite",
  "usp-headline-hero",
  "schema-hotel-graph",
  "hotel-faq-amenities",
  "prompt-geo-ai-citation",
] as const;

/**
 * Profile/page-sourced variables only. A key is set when — and only when —
 * its source exists; there are no invented fallback values.
 */
export function collectPacketSources(
  profile?: ClientProfile,
  page?: PageAuditData
): Record<string, string> {
  const sources: Record<string, string> = {};
  const set = (key: string, value: string | undefined): void => {
    if (value) sources[key] = value;
  };

  set("hotelName", profile?.name || page?.title.split("|")[0].trim());
  set("cityName", profile?.city);
  set("stateCode", profile?.state);
  set("targetKeyword", profile?.primaryKeywords?.[0]);
  set("phoneNumber", profile?.phone);
  set("streetAddress", profile?.address);
  set("postalCode", profile?.postalCode);
  set("canonicalUrl", page?.canonical || page?.url);
  set("originUrl", page?.origin);

  return sources;
}

function templateById(id: string): SeoStudioTemplate | undefined {
  return SEO_STUDIO_TEMPLATES.find((t) => t.id === id);
}

/** One template's variables: its own defaults, overlaid with sourced values. */
function variablesFor(id: string, sources: Record<string, string>): Record<string, string> {
  return { ...(templateById(id)?.defaultVariables ?? {}), ...sources };
}

/**
 * Render the five packet templates into the copy-paste markdown packet.
 *
 * @param sources - values from `collectPacketSources` (profile/page only).
 * @param dateLabel - pre-formatted date string for the packet header.
 */
export function buildUnifiedPacket(sources: Record<string, string>, dateLabel: string): string {
  const render = (id: string): string => {
    const template = templateById(id);
    if (!template) return "";
    return resolveTemplateContent(template.content, variablesFor(id, sources));
  };

  // Header fields: schema defaults carry property/city/state, the title-meta
  // defaults carry the target keyword and canonical URL.
  const property = variablesFor("schema-hotel-graph", sources);
  const meta = variablesFor("title-meta-suite", sources);

  // Label sample text instead of passing it off as the property's own copy:
  // any packet variable the profile/page did not supply keeps the template's
  // sample value (e.g. a sample hero image URL or FAQ policy).
  const usesTemplateSamples = PACKET_TEMPLATE_IDS.some((id) =>
    Object.keys(templateById(id)?.defaultVariables ?? {}).some((key) => !(key in sources))
  );
  const sampleNote = usesTemplateSamples
    ? "\n> Values not supplied by the profile or page show the template's sample text — review before publishing.\n"
    : "";

  return `# SEO Studio & GEO Production Deliverable Packet
**Property:** ${property.hotelName ?? ""} (${property.cityName ?? ""}, ${property.stateCode ?? ""})  
**Target URL:** ${meta.canonicalUrl ?? ""}  
**Primary Target Keyword:** ${meta.targetKeyword ?? ""}  
**Date Generated:** ${dateLabel}
${sampleNote}
---

## 1. On-Page Title Tag & Meta Description
\`\`\`html
${render("title-meta-suite")}
\`\`\`

---

## 2. H1 Headline & Above-the-Fold USP Banner
\`\`\`html
${render("usp-headline-hero")}
\`\`\`

---

## 3. Validated JSON-LD Schema (@graph Hotel + Breadcrumbs)
\`\`\`json
${render("schema-hotel-graph")}
\`\`\`

---

## 4. On-Page FAQ & Amenities Section
\`\`\`html
${render("hotel-faq-amenities")}
\`\`\`

---

## 5. GEO & AI Citation Optimization Prompt (Perplexity, ChatGPT Search, Gemini)
\`\`\`markdown
${render("prompt-geo-ai-citation")}
\`\`\`
`;
}
