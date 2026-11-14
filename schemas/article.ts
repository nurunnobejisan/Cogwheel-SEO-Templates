/**
 * Cogwheel SEO Templates — Article Schema Builder
 */

export interface ArticleInput {
  url: string;
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  authorUrl?: string;
  publisherName?: string;
  publisherLogo?: string;
  section?: string;
  id?: string;
}

export function buildArticleSchema(input: ArticleInput): Record<string, any> {
  if (!input.headline || !input.url) {
    throw new Error("Article schema requires headline and url.");
  }

  const schemaId = input.id || `${input.url}#article`;

  const schema: Record<string, any> = {
    "@type": "Article",
    "@id": schemaId,
    "isPartOf": {
      "@id": `${new URL(input.url).origin}/#website`
    },
    "headline": input.headline,
    "description": input.description || "",
    "mainEntityOfPage": input.url
  };

  if (input.image) {
    schema["image"] = Array.isArray(input.image) ? input.image : [input.image];
  }

  if (input.datePublished) {
    schema["datePublished"] = input.datePublished;
  }

  if (input.dateModified) {
    schema["dateModified"] = input.dateModified;
  }

  if (input.authorName) {
    schema["author"] = {
      "@type": "Person",
      "name": input.authorName,
      ...(input.authorUrl ? { "url": input.authorUrl } : {})
    };
  }

  if (input.publisherName) {
    schema["publisher"] = {
      "@type": "Organization",
      "name": input.publisherName,
      ...(input.publisherLogo ? { "logo": { "@type": "ImageObject", "url": input.publisherLogo } } : {})
    };
  }

  if (input.section) {
    schema["articleSection"] = input.section;
  }

  return schema;
}
