import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabsPageClient } from "@/components/pages/LabsPageClient";

export const metadata: Metadata = {
  title: "Diagnostic Sandbox — SEO & GEO Studio",
  robots: { index: false, follow: false },
};

export default function LabsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <LabsPageClient />;
}
