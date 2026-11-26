/**
 * SEO Studio Templates — LocalBusiness & LodgingBusiness Schema Builder
 */

export interface LocalBusinessInput {
  name: string;
  url: string;
  type?: "LocalBusiness" | "Hotel" | "LodgingBusiness" | "Resort" | "Motel";
  image?: string | string[];
  telephone?: string;
  email?: string;
  priceRange?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  starRating?: number;
  amenities?: string[];
  id?: string;
}

export function buildLocalBusinessSchema(input: LocalBusinessInput): Record<string, any> {
  if (!input.name || !input.url) {
    throw new Error("LocalBusiness schema requires name and url.");
  }

  const schemaType = input.type || "Hotel";
  const schemaId = input.id || `${input.url}#${schemaType.toLowerCase()}`;

  const schema: Record<string, any> = {
    "@type": schemaType,
    "@id": schemaId,
    "name": input.name,
    "url": input.url
  };

  if (input.image) {
    schema["image"] = Array.isArray(input.image) ? input.image : [input.image];
  }

  if (input.telephone) {
    schema["telephone"] = input.telephone;
  }

  if (input.email) {
    schema["email"] = input.email;
  }

  if (input.priceRange) {
    schema["priceRange"] = input.priceRange;
  }

  if (input.address) {
    schema["address"] = {
      "@type": "PostalAddress",
      ...(input.address.streetAddress ? { "streetAddress": input.address.streetAddress } : {}),
      ...(input.address.addressLocality ? { "addressLocality": input.address.addressLocality } : {}),
      ...(input.address.addressRegion ? { "addressRegion": input.address.addressRegion } : {}),
      ...(input.address.postalCode ? { "postalCode": input.address.postalCode } : {}),
      "addressCountry": input.address.addressCountry || "US"
    };
  }

  if (input.geo && typeof input.geo.latitude === "number" && typeof input.geo.longitude === "number") {
    schema["geo"] = {
      "@type": "GeoCoordinates",
      "latitude": input.geo.latitude,
      "longitude": input.geo.longitude
    };
  }

  if (input.starRating) {
    schema["starRating"] = {
      "@type": "Rating",
      "ratingValue": input.starRating
    };
  }

  if (input.amenities && input.amenities.length > 0) {
    schema["amenityFeature"] = input.amenities.map((amenity) => ({
      "@type": "LocationFeatureSpecification",
      "name": amenity,
      "value": true
    }));
  }

  return schema;
}
