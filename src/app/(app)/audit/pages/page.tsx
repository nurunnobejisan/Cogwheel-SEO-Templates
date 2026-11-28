import type { Metadata } from "next";
import { LegacyCrawlRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Crawled Pages — SEO & GEO Studio",
};

export default function AuditPagesPage() {
  return <LegacyCrawlRoute />;
}
