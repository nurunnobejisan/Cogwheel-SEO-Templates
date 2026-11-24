import { z } from "zod";

/**
 * Single Source of Truth TypeScript / Zod schemas matching schemas/hotel-seo.schema.json.
 * Strict schemas with zero `any` types.
 */

/**
 * Core on-page and technical hospitality audit data for a single inspected property.
 */
export const PropertyAuditSchema = z
  .object({
    url: z.string().url("Target URL must be a valid fully qualified URI"),
    hotelName: z.string().min(1, "Hotel name is required"),
    brand: z.string().min(1, "Brand or franchise flag is required"),
    city: z.string().min(1, "City / market location is required"),
    neighborhood: z.string(),
    title: z.string().min(1, "Title tag is required"),
    metaDescription: z.string().min(1, "Meta description is required"),
    h1: z.string().min(1, "Primary H1 is required"),
    canonical: z.string().url("Canonical URL must be a valid URI"),
    wordCount: z.number().int().nonnegative("Word count must be a non-negative integer"),
  })
  .strict();

export type PropertyAudit = z.infer<typeof PropertyAuditSchema>;

/**
 * Generative Engine Optimization (GEO) and AI search visibility signals.
 */
export const GeoSignalsSchema = z
  .object({
    hasHotelSchema: z.boolean(),
    hasFaqSchema: z.boolean(),
    entityDensityScore: z
      .number()
      .min(0, "Entity density score must be >= 0")
      .max(100, "Entity density score must be <= 100"),
    citationReadinessScore: z
      .number()
      .min(0, "Citation readiness score must be >= 0")
      .max(100, "Citation readiness score must be <= 100"),
    missingEntities: z.array(z.string()),
  })
  .strict();

export type GeoSignals = z.infer<typeof GeoSignalsSchema>;

/**
 * Payload for template rendering and variable substitution.
 */
export const TemplatePayloadSchema = z
  .object({
    templateId: z.string().min(1, "Template ID is required"),
    variables: z.record(z.string()),
    renderedOutput: z.string(),
    validationWarnings: z.array(z.string()),
  })
  .strict();

export type TemplatePayload = z.infer<typeof TemplatePayloadSchema>;

/**
 * Unified Hotel SEO & GEO Audit Document.
 */
export const HotelSeoAuditSchema = z
  .object({
    property: PropertyAuditSchema,
    geoSignals: GeoSignalsSchema,
    templatePayload: TemplatePayloadSchema.optional(),
    auditTimestamp: z.string().datetime().optional(),
  })
  .strict();

export type HotelSeoAudit = z.infer<typeof HotelSeoAuditSchema>;

/**
 * Type-safe validation helpers
 */
export function validatePropertyAudit(data: unknown): PropertyAudit {
  return PropertyAuditSchema.parse(data);
}

export function validateGeoSignals(data: unknown): GeoSignals {
  return GeoSignalsSchema.parse(data);
}

export function validateTemplatePayload(data: unknown): TemplatePayload {
  return TemplatePayloadSchema.parse(data);
}

export function validateHotelSeoAudit(data: unknown): HotelSeoAudit {
  return HotelSeoAuditSchema.parse(data);
}
