import { z } from "zod";

export const deliverableMilestoneItemSchema = z.object({
  taskCategory: z.enum(["On Page", "Technical", "Off Page", "Local", "Reporting"]),
  taskName: z.string().min(1),
  status: z.enum(["completed", "verified_live", "pending_client_action"]),
  primaryImpact: z.string().min(5),
  evidenceOrOutputUrl: z.string().optional(),
});

export const finalSeoGeoProjectReportInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
    brandGuidelines: z.string().optional(),
  }),
  engagementStartDate: z.string().default("2026-01-01"),
  engagementEndDate: z.string().default("2026-12-31"),
  completedTasksCount: z.number().int().nonnegative().default(22),
});

export type FinalSeoGeoProjectReportInput = z.infer<
  typeof finalSeoGeoProjectReportInputSchema
>;

export const finalSeoGeoProjectReportDraftSchema = z.object({
  executiveSummary: z.string().min(30),
  overallProjectScore: z.number().min(0).max(100),
  deliverableMilestones: z.array(deliverableMilestoneItemSchema),
  quantifiableResults: z.object({
    keywordsInTop10: z.number().int().nonnegative(),
    technicalIssuesResolvedPercent: z.number().min(0).max(100),
    organicTrafficGrowthPercent: z.number(),
    aiEngineMentionRatePercent: z.number().min(0).max(100),
  }),
  ongoingMaintenanceChecklist: z.array(z.string()).min(3),
  strategicRoadmapNext12Months: z.array(z.string()).min(2),
});

export type FinalSeoGeoProjectReportDraft = z.infer<
  typeof finalSeoGeoProjectReportDraftSchema
>;
