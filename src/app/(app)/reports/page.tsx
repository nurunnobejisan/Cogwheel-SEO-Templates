import type { Metadata } from "next";
import { LegacyReportsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Reports & Deliverables — SEO & GEO Studio",
};

export default function ReportsPage() {
  return <LegacyReportsRoute initialTab="deck" />;
}
