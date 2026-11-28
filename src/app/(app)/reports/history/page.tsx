import type { Metadata } from "next";
import { LegacyHistoryRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Run History — SEO & GEO Studio",
};

export default function ReportsHistoryPage() {
  return <LegacyHistoryRoute />;
}
