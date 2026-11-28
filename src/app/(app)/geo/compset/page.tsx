import type { Metadata } from "next";
import { LegacyCompsetRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Local Comp-Set Matrix — SEO & GEO Studio",
};

export default function GeoCompsetPage() {
  return <LegacyCompsetRoute />;
}
