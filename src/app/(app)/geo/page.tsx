import type { Metadata } from "next";
import { LegacyGeoRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "AI & GEO Radar — SEO & GEO Studio",
};

export default function GeoRadarPage() {
  return <LegacyGeoRoute />;
}
