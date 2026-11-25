import { PageAuditData } from "../../types/extension";
import { SiteConfig, SiteType } from "../config/site-config";

export interface GeneratedSchemaGraph {
  "@context": "https://schema.org";
  "@graph": Array<Record<string, unknown>>;
}

/**
 * Generates dynamic Schema.org JSON-LD @graph tailored to the resolved SiteType.
 * Preserves Hotel/LodgingBusiness for hospitality while providing native schemas
 * for e-commerce, SaaS, local_business, editorial, corporate, and general websites.
 */
export function generateDynamicJsonLd(
  siteType: SiteType,
  config: SiteConfig,
  pageData: Partial<PageAuditData>
): GeneratedSchemaGraph {
  const origin = pageData.origin || `https://${config.domain}`;
  const pageUrl = pageData.url || origin;
  const pageTitle = pageData.title || `${config.brandName} | ${pageData.h1Elements?.[0] || "Home"}`;
  const pageDesc =
    pageData.metaDesc ||
    `Explore ${config.brandName} for ${config.targetAudience}.`;

  const organizationNode: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: config.brandName,
    url: origin,
  };

  const webPageNode: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: pageTitle,
    description: pageDesc,
    inLanguage: config.locale || pageData.language || "en-US",
    isPartOf: { "@id": `${origin}/#website` },
  };

  const breadcrumbNode: Record<string, unknown> = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: origin,
      },
      ...(pageData.pathname && pageData.pathname !== "/"
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: pageData.h1Elements?.[0] || pageTitle,
              item: pageUrl,
            },
          ]
        : []),
    ],
  };

  const primaryEntity = buildPrimaryEntityNode(siteType, config, pageData, origin, pageUrl, pageTitle, pageDesc);

  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode, webPageNode, primaryEntity, breadcrumbNode],
  };
}

function buildPrimaryEntityNode(
  siteType: SiteType,
  config: SiteConfig,
  pageData: Partial<PageAuditData>,
  origin: string,
  pageUrl: string,
  pageTitle: string,
  pageDesc: string
): Record<string, unknown> {
  switch (siteType) {
    case "hospitality":
      return {
        "@type": "Hotel",
        "@id": `${origin}/#hotel`,
        name: config.brandName,
        url: origin,
        description: pageDesc,
        ...(pageData.detectedNap?.phone ? { telephone: pageData.detectedNap.phone } : {}),
        ...(pageData.detectedNap?.address ? { address: pageData.detectedNap.address } : {}),
        ...(pageData.extractedAmenities && pageData.extractedAmenities.length > 0
          ? {
              amenityFeature: pageData.extractedAmenities.slice(0, 8).map((name) => ({
                "@type": "LocationFeatureSpecification",
                name,
                value: true,
              })),
            }
          : {}),
      };

    case "ecommerce":
      return {
        "@type": "Product",
        "@id": `${pageUrl}#product`,
        name: pageData.ecommerce?.productName || pageData.h1Elements?.[0] || pageTitle,
        description: pageDesc,
        brand: { "@type": "Brand", name: config.brandName },
        ...(pageData.ecommerce?.sku ? { sku: pageData.ecommerce.sku } : {}),
        offers: {
          "@type": "Offer",
          url: pageUrl,
          priceCurrency: pageData.ecommerce?.currency || "USD",
          price: (pageData.ecommerce?.price || "0.00").replace(/[^0-9.]/g, "") || "0.00",
          availability: "https://schema.org/InStock",
        },
      };

    case "saas":
      return {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#software`,
        name: config.brandName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: pageDesc,
        url: pageUrl,
        provider: { "@id": `${origin}/#organization` },
      };

    case "local_business":
      return {
        "@type": "LocalBusiness",
        "@id": `${origin}/#localbusiness`,
        name: config.brandName,
        url: origin,
        description: pageDesc,
        ...(pageData.detectedNap?.phone ? { telephone: pageData.detectedNap.phone } : {}),
        ...(pageData.detectedNap?.address ? { address: pageData.detectedNap.address } : {}),
      };

    case "editorial":
      return {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: pageData.h1Elements?.[0] || pageTitle,
        description: pageDesc,
        mainEntityOfPage: pageUrl,
        publisher: { "@id": `${origin}/#organization` },
      };

    case "corporate":
    case "general":
    default:
      return {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: config.brandName,
        url: origin,
        description: pageDesc,
      };
  }
}
