import { z } from "zod";

export const emailTemplateDraftItemSchema = z.object({
  persona: z.string().min(1),
  subjectLines: z.array(z.string().min(5)).min(2),
  openingHook: z.string().min(10),
  bodyCopy: z.string().min(20),
  valueProposition: z.string().min(10),
  callToAction: z.string().min(5),
  followUpTouchpoints: z
    .array(
      z.object({
        dayOffset: z.number().int().positive(),
        followUpSubject: z.string().min(5),
        followUpAngle: z.string().min(10),
      }),
    )
    .min(1),
});

export type EmailTemplateDraftItem = z.infer<typeof emailTemplateDraftItemSchema>;

export const emailOutreachFormattingInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
    contactEmail: z.string().email().optional(),
  }),
  targetPersonas: z
    .array(
      z.enum([
        "wedding_planner",
        "travel_editor",
        "tourism_board",
        "corporate_event_planner",
        "food_beverage_critic",
        "local_business_partner",
      ]),
    )
    .min(1),
  linkableAssetHook: z.string().min(5),
});

export type EmailOutreachFormattingInput = z.infer<
  typeof emailOutreachFormattingInputSchema
>;

export const emailOutreachFormattingDraftSchema = z.object({
  templates: z.array(emailTemplateDraftItemSchema),
  outreachBestPractices: z.array(z.string()),
});

export type EmailOutreachFormattingDraft = z.infer<
  typeof emailOutreachFormattingDraftSchema
>;
