import type { Metadata } from "next";
import { HeadingsAuditClient } from "@/components/pages/HeadingsAuditClient";

export const metadata: Metadata = {
  title: "Heading Structure Audit — SEO & GEO Studio",
};

export default function AuditHeadingsPage() {
  return <HeadingsAuditClient />;
}
