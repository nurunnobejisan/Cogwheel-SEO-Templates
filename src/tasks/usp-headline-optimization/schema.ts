import { z } from "zod";
import type { HiltonSectionId } from "@/config/hilton-rules";
import { propertySchema } from "@/lib/schemas";

export const HILTON_SECTION_IDS: HiltonSectionId[] = [
  "home-headline",
  "home-description",
  "usp-callout",
  "half-and-half",
  "location",
  "dining-main",
  "dining-outlet",
  "rooms",
  "suites",
  "hotel-info",
  "offers",
  "gallery",
  "events",
];

export const uspHeadlineInputSchema = z.object({
  runId: z.string().uuid().optional(),
  property: propertySchema,
  matrix: z.array(
    z.object({
      pageId: z.string(),
      path: z.string(),
      title: z.string(),
      primary: z.object({ keyword: z.string(), volume: z.number(), kd: z.number().nullable() }).nullable(),
      secondary: z.object({ keyword: z.string(), volume: z.number(), kd: z.number().nullable() }).nullable().optional(),
    }),
  ),
  discoveryNotes: z.object({
    demandGenerators: z.string().default(""),
    usps: z.array(z.string()).default([]),
  }),
  liveCopy: z.record(z.string()).default({}),
  grandfatheredOutlet: z.boolean().default(false),
  generateDoc: z.boolean().default(true),
});

export type UspHeadlineInput = z.infer<typeof uspHeadlineInputSchema>;
