import type { Metadata } from "next";
import { LegacySuiteRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Search Console & Cannibalization — SEO & GEO Studio",
};

export default function SearchConsolePage() {
  return <LegacySuiteRoute initialSubTab="gsc-intel" />;
}
