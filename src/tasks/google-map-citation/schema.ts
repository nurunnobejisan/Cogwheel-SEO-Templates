import { z } from "zod";

export const citationDirectoryAuditItemSchema = z.object({
  directoryName: z.string().min(1),
  domain: z.string().min(1),
  domainAuthority: z.number().int().min(0).max(100).nullable().optional(),
  status: z.enum(["verified_consistent", "nap_discrepancy", "missing_listing", "unclaimed"]),
  currentName: z.string().optional(),
  currentAddress: z.string().optional(),
  currentPhone: z.string().optional(),
  fixAction: z.string().min(3),
});

export type CitationDirectoryAuditItem = z.infer<typeof citationDirectoryAuditItemSchema>;

export const googleMapCitationInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    address: z.string().default(""),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().optional(),
    phone: z.string().default(""),
    url: z.string().url(),
  }),
  gbpCategories: z.array(z.string()).optional(),
  sampleCitations: z
    .array(
      z.object({
        directoryName: z.string(),
        domain: z.string(),
        nameFound: z.string().optional(),
        addressFound: z.string().optional(),
        phoneFound: z.string().optional(),
      }),
    )
    .optional(),
});

export type GoogleMapCitationInput = z.infer<typeof googleMapCitationInputSchema>;

export const googleMapCitationDraftSchema = z.object({
  napConsistencyScore: z.number().min(0).max(100),
  gbpCategoryRecommendation: z.object({
    primaryCategory: z.string(),
    secondaryCategories: z.array(z.string()),
    categoryRationale: z.string(),
  }),
  citationDirectoryAudits: z.array(citationDirectoryAuditItemSchema),
  napDiscrepancies: z.array(
    z.object({
      directory: z.string(),
      discrepancyType: z.enum(["name", "address", "phone", "url"]),
      foundValue: z.string(),
      expectedValue: z.string(),
    }),
  ),
  immediateFixChecklist: z.array(z.string()),
});

export type GoogleMapCitationDraft = z.infer<typeof googleMapCitationDraftSchema>;
