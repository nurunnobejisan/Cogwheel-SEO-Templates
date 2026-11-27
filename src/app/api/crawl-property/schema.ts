import { z } from "zod";

/**
 * Body schema for `POST /api/crawl-property`.
 *
 * Kept in its own module because Next's route-type check only allows handlers
 * and route config to be exported from `route.ts`.
 */
export const crawlPropertyBodySchema = z.object({
  url: z.string().trim().url("Please enter a valid property URL (https://...)"),
  /**
   * Client/property id that owns the crawl. It becomes part of the server-side
   * crawl cache key so two properties never share a cached result.
   */
  scopeKey: z.string().trim().min(1).max(200).optional(),
});
