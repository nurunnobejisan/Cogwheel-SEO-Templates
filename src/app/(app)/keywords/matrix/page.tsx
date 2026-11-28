import type { Metadata } from "next";
import { LegacyStudioRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Keyword Matrix Studio — SEO & GEO Studio",
};

export default function KeywordMatrixPage() {
  return <LegacyStudioRoute initialStep={1} />;
}
