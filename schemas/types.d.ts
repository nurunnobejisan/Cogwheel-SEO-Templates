/**
 * SEO Studio Templates — Strongly Typed Schema.org Types (schema-dts compatible)
 */

export interface SchemaThing {
  "@type": string;
  "@id"?: string;
  name?: string;
  description?: string;
  url?: string;
  image?: string | string[];
  [key: string]: any;
}

export interface SchemaArticle extends SchemaThing {
  "@type": "Article";
  headline: string;
  datePublished?: string;
  dateModified?: string;
  author?: {
    "@type": "Person" | "Organization";
    name: string;
    url?: string;
  };
  publisher?: {
    "@type": "Organization";
    name: string;
    logo?: {
      "@type": "ImageObject";
      url: string;
    };
  };
  mainEntityOfPage?: string;
  articleSection?: string;
}

export interface SchemaOffer extends SchemaThing {
  "@type": "Offer";
  price: string;
  priceCurrency: string;
  availability: string;
  url?: string;
}

export interface SchemaAggregateRating extends SchemaThing {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

export interface SchemaProduct extends SchemaThing {
  "@type": "Product";
  name: string;
  offers?: SchemaOffer;
  aggregateRating?: SchemaAggregateRating;
  brand?: {
    "@type": "Brand";
    name: string;
  };
  sku?: string;
}

export interface SchemaPostalAddress extends SchemaThing {
  "@type": "PostalAddress";
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

export interface SchemaGeoCoordinates extends SchemaThing {
  "@type": "GeoCoordinates";
  latitude: number;
  longitude: number;
}

export interface SchemaHotel extends SchemaThing {
  "@type": "Hotel" | "LodgingBusiness" | "Resort" | "Motel" | "LocalBusiness";
  telephone?: string;
  email?: string;
  priceRange?: string;
  address?: SchemaPostalAddress;
  geo?: SchemaGeoCoordinates;
  amenityFeature?: Array<{
    "@type": "LocationFeatureSpecification";
    name: string;
    value: boolean;
  }>;
}

export interface SchemaQuestion extends SchemaThing {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

export interface SchemaFAQPage extends SchemaThing {
  "@type": "FAQPage";
  mainEntity: SchemaQuestion[];
}

export interface SchemaBreadcrumbList extends SchemaThing {
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

export interface SchemaGraph {
  "@context": "https://schema.org";
  "@graph": SchemaThing[];
}
