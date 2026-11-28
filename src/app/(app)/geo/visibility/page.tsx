import type { Metadata } from "next";
import { LegacyVisibilityRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "AI Visibility Connector — SEO & GEO Studio",
};

export default function GeoVisibilityPage() {
  return <LegacyVisibilityRoute />;
}
