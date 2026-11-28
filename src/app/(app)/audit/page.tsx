import type { Metadata } from "next";
import { AuditOverviewClient } from "@/components/pages/AuditOverviewClient";

export const metadata: Metadata = {
  title: "Website Audit Overview — SEO & GEO Studio",
};

export default function AuditOverviewPage() {
  return <AuditOverviewClient />;
}
