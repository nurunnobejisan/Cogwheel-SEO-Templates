import { z } from "zod";

export const linkableAssetItemSchema = z.object({
  assetTitle: z.string().min(1),
  pageUrl: z.string().url().optional(),
  uniqueHook: z.string().min(5),
  targetAudiences: z.array(z.string()).min(1),
  pitchAngle: z.string().min(5),
  estimatedLinkEquity: z.enum(["High", "Medium", "Tier-1 Editorial"]),
});

export const outreachTargetCategorySchema = z.object({
  categoryName: z.string().min(1),
  description: z.string(),
  exampleOutlets: z.array(z.string()).min(1),
  approachStrategy: z.string().min(5),
});

export const internalKickoffStrategyListInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
    amenities: z.array(z.string()).optional(),
    diningInfo: z.array(z.string()).optional(),
    attractions: z.array(z.string()).optional(),
  }),
  focusAngles: z.array(z.string()).optional(),
});

export type InternalKickoffStrategyListInput = z.infer<
  typeof internalKickoffStrategyListInputSchema
>;

export const internalKickoffStrategyListDraftSchema = z.object({
  executiveOffPageVision: z.string().min(10),
  linkableAssets: z.array(linkableAssetItemSchema),
  outreachCategories: z.array(outreachTargetCategorySchema),
  immediateNextSteps: z.array(z.string()),
});

export type InternalKickoffStrategyListDraft = z.infer<
  typeof internalKickoffStrategyListDraftSchema
>;
