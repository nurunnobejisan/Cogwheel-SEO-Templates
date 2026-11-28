import { z } from "zod";

/**
 * SEO Studio Templates — Zod Schemas for Strict Variable Resolution & Fallbacks
 * Shared with Python via JSON Schema in /shared/schemas/
 */

// 1. Destination Guide Schema
export const DestinationGuideZodSchema = z.object({
  hotelName: z.string().min(1, "hotelName is required"),
  brand: z.string().default("Independent Collection"),
  cityName: z.string().min(1, "cityName is required"),
  destinationTitle: z.string().min(5, "destinationTitle must be at least 5 characters"),
  destinationSubtitle: z.string().default("Premier travel insights and local recommendations"),
  destinationOverview: z.string().min(20, "destinationOverview must be descriptive (min 20 characters)"),
  amenitiesList: z.string().default("modern luxury amenities, on-site dining, and 24/7 guest services"),
  bookingPerks: z.string().default("lowest direct booking rate guarantee and flexible cancellations"),
  attractionsSummary: z.string().default("convenient access to cultural attractions, dining districts, and local transit")
});

export type DestinationGuideInput = z.infer<typeof DestinationGuideZodSchema>;

// 2. Room Showcase Schema
export const RoomShowcaseZodSchema = z.object({
  hotelName: z.string().min(1, "hotelName is required"),
  cityName: z.string().min(1, "cityName is required"),
  roomTitle: z.string().min(3, "roomTitle must be at least 3 characters"),
  roomStartingRate: z.string().default("Best Available Rate"),
  roomDescription: z.string().min(20, "roomDescription must be descriptive"),
  roomAmenities: z.string().default("King pillow-top bed, high-speed WiFi, smart television, and luxury bath amenities")
});

export type RoomShowcaseInput = z.infer<typeof RoomShowcaseZodSchema>;

// 3. Hotel FAQ & Amenities Schema
export const HotelFaqZodSchema = z.object({
  hotelName: z.string().min(1, "hotelName is required"),
  cityName: z.string().min(1, "cityName is required"),
  checkInOutPolicy: z.string().default("Check-in begins at 4:00 PM; check-out is by 11:00 AM."),
  parkingPolicy: z.string().default("On-site valet parking is available 24/7 for all registered guests."),
  petPolicy: z.string().default("Designated pet-friendly rooms are available upon request.")
});

export type HotelFaqInput = z.infer<typeof HotelFaqZodSchema>;

// 4. Page Metadata Schema (for Title, Canonical, Meta Description, Robots)
export const PageMetadataZodSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(70, "Title should not exceed 70 characters"),
  metaDescription: z.string().min(50, "Meta description should be at least 50 characters").max(160, "Meta description should not exceed 160 characters"),
  canonicalUrl: z.string().url("canonicalUrl must be a valid HTTPS URL"),
  robotsDirective: z.string().default("index, follow"),
  focusKeyword: z.string().optional()
});

export type PageMetadataInput = z.infer<typeof PageMetadataZodSchema>;

// 5. Site Manifest Schema (for Internal Link Graph)
export const SiteManifestItemZodSchema = z.object({
  url: z.string().url(),
  primaryKeyword: z.string().min(2),
  secondaryTags: z.array(z.string()).default([]),
  parentPage: z.string().url().optional(),
  categoryHierarchy: z.array(z.string()).default([]),
  approvedAnchorVariations: z.array(z.string()).default([])
});

export const SiteManifestZodSchema = z.array(SiteManifestItemZodSchema);
export type SiteManifestInput = z.infer<typeof SiteManifestZodSchema>;

/**
 * Strict resolver helper: parses raw data using a Zod schema,
 * populating all defaults and returning structured errors if invalid.
 */
export function resolveWithZod<T extends z.ZodTypeAny>(
  schema: T,
  rawData: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(rawData);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (err) => `[${err.path.join(".") || "root"}] ${err.message}`
  );
  return { success: false, errors };
}
