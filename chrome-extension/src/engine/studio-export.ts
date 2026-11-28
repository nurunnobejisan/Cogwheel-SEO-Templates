/**
 * TemplateStudio export helpers — pure functions so both the live fields and
 * the bundled "ready-to-paste" snippet can be tested without rendering.
 *
 * Every value in the snippet comes from the page, the client profile or the
 * operator's own live fields. Nothing is invented: no stock photos, fake
 * phone numbers, placeholder addresses, star ratings or prices are ever
 * emitted — unsourced properties are omitted instead. The only derived values
 * are structural: the schema `@type` picked from the page's measured category
 * and breadcrumb position labels.
 */
import type { ClientProfile, PageAuditData } from "../types/extension";
import type { BrandRules } from "../utils/brandGuardrails";

const AMP = "&";
const ENTITIES: Record<string, string> = {
  "&": AMP + "amp;",
  "<": AMP + "lt;",
  ">": AMP + "gt;",
  '"': AMP + "quot;",
};

/** Initial values for the four live-editable Studio fields. */
export function initialLiveFields(
  pageData?: PageAuditData,
  activeProfile?: ClientProfile
): { title: string; meta: string; h1: string; geoAnswer: string } {
  let title = "";
  if (pageData?.title) {
    title = pageData.title;
  } else if (activeProfile?.name) {
    title = activeProfile.city ? `${activeProfile.name} in ${activeProfile.city}` : activeProfile.name;
  }
  return {
    title,
    meta: pageData?.metaDesc || "",
    h1: pageData?.h1Elements?.[0] || activeProfile?.name || "",
    // GEO knowledge block starts blank — there is no verified content to
    // summarize until the page or an AI provider supplies some.
    geoAnswer: "",
  };
}

export interface StudioSnippetInput {
  pageData?: PageAuditData;
  activeProfile?: ClientProfile;
  liveTitle: string;
  liveMeta: string;
  liveH1: string;
  liveGeoAnswer: string;
  activeGuardrail: BrandRules;
}

const escapeJsonString = (v: string): string => v.replace(/"/g, '\\"');
const escapeAttr = (v: string): string => v.replace(/[&<>"]/g, (m) => ENTITIES[m]);

/** Build the bundled HTML + JSON-LD snippet TemplateStudio offers for copy/download. */
export function buildReadyToPasteSnippet({
  pageData,
  activeProfile,
  liveTitle,
  liveMeta,
  liveH1,
  liveGeoAnswer,
  activeGuardrail,
}: StudioSnippetInput): string {
  const cat = pageData?.siteCategory || "general";
  const canonical = pageData?.canonical || pageData?.url || "";
  const origin = pageData?.origin || "";
  const entityTitle = liveH1 || pageData?.title || activeProfile?.name || "";
  const ogImage = pageData?.ogImage || "";
  const brandName = activeProfile?.name || pageData?.hostname || "";
  const idBase = origin || canonical;

  const namedEntity = (type: string, idSuffix: string): Record<string, unknown> => {
    const node: Record<string, unknown> = { "@type": type };
    if (canonical) node["@id"] = `${canonical}#${idSuffix}`;
    if (entityTitle) node.name = escapeJsonString(entityTitle);
    if (liveMeta) node.description = escapeJsonString(liveMeta);
    if (canonical) node.url = canonical;
    if (ogImage) node.image = ogImage;
    return node;
  };

  const addressNode = (): Record<string, unknown> | null => {
    const street = activeProfile?.address || "";
    const locality = activeProfile?.city || "";
    const region = activeProfile?.state || "";
    const postal = activeProfile?.postalCode || "";
    if (!street && !locality && !region && !postal) return null;
    const node: Record<string, unknown> = { "@type": "PostalAddress" };
    if (street) node.streetAddress = street;
    if (locality) node.addressLocality = locality;
    if (region) node.addressRegion = region;
    if (postal) node.postalCode = postal;
    node.addressCountry = "US";
    return node;
  };

  let ogType = "website";
  let entityBlockTag = "WebSite";
  const entities: Record<string, unknown>[] = [];

  if (cat === "ecommerce") {
    ogType = "product";
    entityBlockTag = "Product";
    const ecom = pageData?.ecommerce;
    const node = namedEntity("Product", "product");
    if (brandName) node.brand = { "@type": "Brand", name: escapeJsonString(brandName) };
    const cleanPrice = (ecom?.price || "").replace(/[^0-9.]/g, "");
    if (cleanPrice) {
      const offers: Record<string, unknown> = { "@type": "Offer", price: cleanPrice };
      if (ecom?.currency) offers.priceCurrency = ecom.currency;
      if (ecom?.availability) offers.availability = `https://schema.org/${ecom.availability}`;
      node.offers = offers;
    }
    entities.push(node);
  } else if (cat === "saas") {
    ogType = "website";
    entityBlockTag = "SoftwareApplication";
    const node = namedEntity("SoftwareApplication", "software");
    node.applicationCategory = "BusinessApplication";
    entities.push(node);
  } else if (cat === "editorial") {
    ogType = "article";
    entityBlockTag = "Article";
    const node = namedEntity("Article", "article");
    if (liveTitle) node.headline = escapeJsonString(liveTitle);
    if (canonical) node.mainEntityOfPage = canonical;
    if (brandName) {
      node.author = { "@type": "Person", name: escapeJsonString(brandName) };
      const publisher: Record<string, unknown> = {
        "@type": "Organization",
        name: escapeJsonString(brandName),
      };
      if (idBase) publisher.url = idBase;
      node.publisher = publisher;
    }
    entities.push(node);
  } else if (cat === "local_business") {
    ogType = "business.business";
    entityBlockTag = "LocalBusiness";
    const node = namedEntity("LocalBusiness", "localbusiness");
    if (activeProfile?.phone) node.telephone = activeProfile.phone;
    const address = addressNode();
    if (address) node.address = address;
    entities.push(node);
  } else if (cat === "hospitality") {
    ogType = "hotel";
    entityBlockTag = "Hotel";
    const node = namedEntity("Hotel", "hotel");
    const address = addressNode();
    if (address) node.address = address;
    if (activeProfile?.phone) node.telephone = activeProfile.phone;
    // No price range or star rating is ever emitted — neither is sourced here.
    entities.push(node);
  } else {
    ogType = "website";
    entityBlockTag = "Organization";
    const org: Record<string, unknown> = { "@type": "Organization" };
    if (idBase) org["@id"] = `${idBase}#organization`;
    if (brandName) org.name = escapeJsonString(brandName);
    if (idBase) org.url = idBase;
    if (liveMeta) org.description = escapeJsonString(liveMeta);
    if (ogImage) org.logo = ogImage;
    if (brandName || idBase) entities.push(org);

    const site: Record<string, unknown> = { "@type": "WebSite" };
    if (idBase) site["@id"] = `${idBase}#website`;
    if (idBase) site.url = idBase;
    if (entityTitle) site.name = escapeJsonString(entityTitle);
    if (site.name || site.url) entities.push(site);
  }

  // Breadcrumb list — structural labels only, URLs from the page.
  const breadcrumbItems: Array<Record<string, unknown>> = [];
  const homeItem = origin || canonical;
  if (homeItem) {
    breadcrumbItems.push({ "@type": "ListItem", position: 1, name: "Home", item: homeItem });
  }
  const secondLabel = activeProfile?.city || entityTitle;
  if (canonical && secondLabel) {
    breadcrumbItems.push({ "@type": "ListItem", position: 2, name: secondLabel, item: canonical });
  }
  if (breadcrumbItems.length > 0) {
    const breadcrumb: Record<string, unknown> = {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    };
    if (canonical) breadcrumb["@id"] = `${canonical}#breadcrumb`;
    entities.push(breadcrumb);
  }

  const lines: string[] = [];
  lines.push("<!-- SEO Studio v3.0 - Universal Brand Guardrail Compliant Export -->");
  lines.push(
    `<!-- Platform Framework: ${pageData?.detectedCmsLabel || "Universal"} | Category: ${
      pageData?.siteCategoryLabel || cat.toUpperCase()
    } -->`
  );
  lines.push(`<!-- Policy Profile: ${activeGuardrail.name} (${activeGuardrail.loyaltyProgram}) -->`);
  lines.push("");
  lines.push("<!-- 1. Primary Metadata & Search Snippets -->");
  if (liveTitle) lines.push(`<title>${liveTitle}</title>`);
  if (liveMeta) lines.push(`<meta name="description" content="${escapeAttr(liveMeta)}" />`);
  if (canonical) lines.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);
  lines.push("");
  lines.push("<!-- 2. Open Graph & Social Sharing Card -->");
  lines.push(`<meta property="og:type" content="${ogType}" />`);
  const siteName = activeProfile?.name || pageData?.hostname || "";
  if (siteName) lines.push(`<meta property="og:site_name" content="${escapeAttr(siteName)}" />`);
  if (liveTitle) lines.push(`<meta property="og:title" content="${escapeAttr(liveTitle)}" />`);
  if (liveMeta) lines.push(`<meta property="og:description" content="${escapeAttr(liveMeta)}" />`);
  if (canonical) lines.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);
  if (ogImage) lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  lines.push("");
  if (entityTitle) {
    lines.push("<!-- 3. Above-the-Fold Primary H1 -->");
    lines.push(`<h1>${entityTitle}</h1>`);
    lines.push("");
  }
  lines.push("<!-- 4. Generative AI Knowledge Entity Block -->");
  if (liveGeoAnswer) {
    lines.push(
      `<section class="geo-entity-block" data-geo-entity="${entityBlockTag}" aria-label="Entity Overview">`
    );
    lines.push(`  <p>${liveGeoAnswer}</p>`);
    lines.push("</section>");
  } else {
    lines.push("<!-- No verified GEO knowledge block — generate one from the page facts first. -->");
  }
  lines.push("");
  if (entities.length > 0) {
    lines.push(`<!-- 5. Validated JSON-LD Schema (@graph ${entityBlockTag} + BreadcrumbList) -->`);
    lines.push(`<script type="application/ld+json">`);
    lines.push(JSON.stringify({ "@context": "https://schema.org", "@graph": entities }, null, 2));
    lines.push(`</script>`);
  }

  return lines.join("\n");
}
