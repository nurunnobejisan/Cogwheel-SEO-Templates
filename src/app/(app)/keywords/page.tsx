import type { Metadata } from "next";
import { LegacyKeywordsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Keyword Research — SEO & GEO Studio",
};

export default function KeywordsPage() {
  return <LegacyKeywordsRoute />;
}
