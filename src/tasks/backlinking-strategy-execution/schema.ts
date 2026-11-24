import { z } from "zod";

export const backlinkPipelineItemSchema = z.object({
  targetDomain: z.string().min(1),
  contactPersona: z.string(),
  pitchAngle: z.string().min(5),
  status: z.enum(["prospect", "contacted", "in_negotiation", "acquired", "declined"]).default("prospect"),
  assignedSpecialist: z.string().optional(),
  targetDestinationUrl: z.string().url(),
  expectedLinkType: z.enum(["editorial_mention", "resource_page", "partner_directory", "press_feature"]),
  followUpDate: z.string().optional(),
});

export type BacklinkPipelineItem = z.infer<typeof backlinkPipelineItemSchema>;

export const backlinkingStrategyExecutionInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
  }),
  targetProspects: z.array(z.string()).optional(),
  targetAcquisitionCount: z.number().int().positive().default(10),
});

export type BacklinkingStrategyExecutionInput = z.infer<
  typeof backlinkingStrategyExecutionInputSchema
>;

export const backlinkingStrategyExecutionDraftSchema = z.object({
  roadmapPhases: z.array(
    z.object({
      phaseName: z.string(),
      timelineWeeks: z.string(),
      primaryDeliverable: z.string(),
      targetAcquisitions: z.number().int().nonnegative(),
    }),
  ),
  outreachPipeline: z.array(backlinkPipelineItemSchema),
  kpiTargets: z.object({
    targetHighAuthorityLinks: z.number().int().nonnegative(),
    targetLocalCitations: z.number().int().nonnegative(),
    targetEditorialFeatures: z.number().int().nonnegative(),
  }),
});

export type BacklinkingStrategyExecutionDraft = z.infer<
  typeof backlinkingStrategyExecutionDraftSchema
>;
