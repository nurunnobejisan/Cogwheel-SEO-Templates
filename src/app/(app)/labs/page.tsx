import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyLabsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Diagnostic Sandbox — SEO & GEO Studio",
  robots: { index: false, follow: false },
};

export default function LabsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <LegacyLabsRoute />;
}
