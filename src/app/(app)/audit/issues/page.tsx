import type { Metadata } from "next";
import { LegacySuiteRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Audit Issue Report — SEO & GEO Studio",
};

export default function AuditIssuesPage() {
  return <LegacySuiteRoute initialSubTab="full-audit" />;
}
