import { Suspense } from "react";
import type { Metadata } from "next";
import { AuditIssuesClient } from "@/components/pages/AuditIssuesClient";
import { Skeleton } from "@/components/ui/index";

export const metadata: Metadata = {
  title: "Audit Issue Report — SEO & GEO Studio",
};

export default function AuditIssuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuditIssuesClient />
    </Suspense>
  );
}
