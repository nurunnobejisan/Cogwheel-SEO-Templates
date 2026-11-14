/**
 * Cogwheel SEO Templates — Product Schema Builder
 */

export interface ProductInput {
  name: string;
  description: string;
  url: string;
  image?: string | string[];
  sku?: string;
  brand?: string;
  price?: number | string;
  priceCurrency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  ratingValue?: number;
  reviewCount?: number;
  id?: string;
}

export function buildProductSchema(input: ProductInput): Record<string, any> {
  if (!input.name || !input.url) {
    throw new Error("Product schema requires name and url.");
  }

  const schemaId = input.id || `${input.url}#product`;

  const schema: Record<string, any> = {
    "@type": "Product",
    "@id": schemaId,
    "name": input.name,
    "description": input.description || "",
    "url": input.url
  };

  if (input.image) {
    schema["image"] = Array.isArray(input.image) ? input.image : [input.image];
  }

  if (input.sku) {
    schema["sku"] = input.sku;
  }

  if (input.brand) {
    schema["brand"] = {
      "@type": "Brand",
      "name": input.brand
    };
  }

  // Include Offer if price data exists
  if (input.price !== undefined && input.price !== null && input.price !== "") {
    schema["offers"] = {
      "@type": "Offer",
      "price": String(input.price),
      "priceCurrency": input.priceCurrency || "USD",
      "availability": `https://schema.org/${input.availability || "InStock"}`,
      "url": input.url
    };
  }

  // Include AggregateRating if rating and reviewCount exist
  if (input.ratingValue && input.reviewCount && input.reviewCount > 0) {
    schema["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": Number(input.ratingValue),
      "reviewCount": Number(input.reviewCount),
      "bestRating": 5,
      "worstRating": 1
    };
  }

  return schema;
}
