import type { Metadata } from "next";
import { LegacyPropertySettingsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Property Profile — SEO & GEO Studio",
};

export default function PropertySettingsPage() {
  return <LegacyPropertySettingsRoute />;
}
