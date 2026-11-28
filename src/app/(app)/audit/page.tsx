import type { Metadata } from "next";
import { LegacySuiteRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Website Audit Overview — SEO & GEO Studio",
};

export default function AuditOverviewPage() {
  return <LegacySuiteRoute initialSubTab="full-audit" />;
}
