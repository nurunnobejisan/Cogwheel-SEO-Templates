import type { Metadata } from "next";
import { LegacySitemapRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "XML Sitemap Audit — SEO & GEO Studio",
};

export default function AuditSitemapPage() {
  return <LegacySitemapRoute />;
}
