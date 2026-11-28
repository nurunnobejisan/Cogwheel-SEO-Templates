import type { Metadata } from "next";
import { LegacyHeadingsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Heading Structure Audit — SEO & GEO Studio",
};

export default function AuditHeadingsPage() {
  return <LegacyHeadingsRoute />;
}
