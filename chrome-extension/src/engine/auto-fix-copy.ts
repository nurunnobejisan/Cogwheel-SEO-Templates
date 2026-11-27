/**
 * Pure helpers for the side panel's "Fix with template" handler.
 *
 * Everything here obeys one rule: **measure, label, or leave blank**. Values
 * are only written when a real source produced them (the page itself, or the
 * client profile the operator saved). Anything without a source is left out of
 * the markup and reported in `blankFields` so the drawer can say so, instead of
 * quietly shipping template copy as if it were this property's data.
 */

export interface ProfileFacts {
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface SchemaDraft {
  schema: Record<string, unknown>;
  /** Fields deliberately omitted because no source supplied a value. */
  blankFields: string[];
}

export interface HotelSchemaInput {
  siteName: string;
  canonicalUrl: string;
  /** Raw meta description from the page; blank stays blank. */
  metaDesc: string;
  profile: ProfileFacts;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Hotel JSON-LD built only from sourced facts. Description comes from the
 * page's own meta description (empty when the page has none); contact details
 * come from the saved client profile. Coordinates, check-in/out times and
 * amenities have no source in the panel, so they are never written.
 */
export function buildHotelSchema(input: HotelSchemaInput): SchemaDraft {
  const blankFields: string[] = [];
  const schema: Record<string, unknown> = {
    "@type": "Hotel",
    name: input.siteName,
    url: input.canonicalUrl,
  };

  const description = clean(input.metaDesc);
  schema.description = description;
  if (!description) blankFields.push("description — page has no meta description");

  const telephone = clean(input.profile.phone);
  if (telephone) schema.telephone = telephone;
  else blankFields.push("telephone — not in the client profile");

  const street = clean(input.profile.address);
  const city = clean(input.profile.city);
  const state = clean(input.profile.state);
  const postalCode = clean(input.profile.postalCode);
  if (street || city || state || postalCode) {
    const address: Record<string, unknown> = { "@type": "PostalAddress", addressCountry: "US" };
    if (street) address.streetAddress = street;
    else blankFields.push("address.streetAddress — not in the client profile");
    if (city) address.addressLocality = city;
    if (state) address.addressRegion = state;
    if (postalCode) address.postalCode = postalCode;
    schema.address = address;
  } else {
    blankFields.push("address — not in the client profile");
  }

  blankFields.push(
    "geo coordinates — no verified source",
    "check-in/check-out times — no verified source",
    "amenity features — no verified source",
    "priceRange — no verified source",
  );

  return { schema, blankFields };
}

export interface OrganizationSchemaInput {
  siteName: string;
  canonicalUrl: string;
  metaDesc: string;
  socialLinks?: Array<{ url: string }>;
}

/** Organization JSON-LD: description blank when the page has none. */
export function buildOrganizationSchema(input: OrganizationSchemaInput): SchemaDraft {
  const blankFields: string[] = [];
  const description = clean(input.metaDesc);
  const schema: Record<string, unknown> = {
    "@type": "Organization",
    name: input.siteName,
    url: input.canonicalUrl,
    description,
  };
  if (!description) blankFields.push("description — page has no meta description");

  const sameAs = (input.socialLinks ?? []).map((l) => l.url).filter(Boolean);
  if (sameAs.length > 0) schema.sameAs = sameAs;

  return { schema, blankFields };
}

export interface SocialSnippetInput {
  siteName: string;
  title: string;
  metaDesc: string;
  /** Existing og:image or the first image on the page, if any. */
  image?: string;
  url: string;
}

export interface SocialSnippet {
  snippet: string;
  blankFields: string[];
}

/**
 * Open Graph / Twitter markup. Missing description or image means the tag is
 * omitted and reported — an invented tagline or a stock photo would both be
 * claims about a page that does not have them.
 */
export function buildSocialSnippet(input: SocialSnippetInput): SocialSnippet {
  const blankFields: string[] = [];
  const title = clean(input.title) || clean(input.siteName);
  const description = clean(input.metaDesc);
  const image = clean(input.image);

  if (!description) blankFields.push("og:description — page has no meta description");
  if (!image) blankFields.push("og:image — no image found on the page");

  const lines = [
    "<!-- Open Graph & Twitter Social Metadata -->",
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${input.siteName}" />`,
    `<meta property="og:title" content="${title}" />`,
  ];
  if (description) lines.push(`<meta property="og:description" content="${description}" />`);
  if (image) lines.push(`<meta property="og:image" content="${image}" />`);
  lines.push(`<meta property="og:url" content="${input.url}" />`);
  lines.push(`<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  lines.push(`<meta name="twitter:title" content="${title}" />`);
  if (description) lines.push(`<meta name="twitter:description" content="${description}" />`);
  if (image) lines.push(`<meta name="twitter:image" content="${image}" />`);

  return { snippet: lines.join("\n"), blankFields };
}

/**
 * FAQ schema is only ever injected from a source that actually holds the
 * answers. The panel has none — the local rules engine would have to invent
 * check-in times and amenity claims — so FAQ markup is never generated here.
 */
export const FAQ_REQUIRES_VERIFIED_ANSWERS =
  "No verified FAQ answers exist for this page. SEO Studio will not invent amenity, policy or check-in answers — add your own Q&A (or connect an AI provider) before publishing FAQ schema.";

/** Append labelled caveats to a drawer description. */
export function withFlags(base: string, flags: string[]): string {
  if (flags.length === 0) return base;
  return `${base}\n\nNot populated (no verified source):\n${flags.map((f) => `• ${f}`).join("\n")}`;
}
