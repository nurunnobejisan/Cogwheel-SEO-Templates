import type { Metadata } from "next";
import { LegacyStudioRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Content Studio — SEO & GEO Studio",
};

export default function ContentStudioPage() {
  return <LegacyStudioRoute initialStep={4} />;
}
