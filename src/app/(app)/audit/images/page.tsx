import type { Metadata } from "next";
import { LegacyImagesRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Image Optimization Audit — SEO & GEO Studio",
};

export default function AuditImagesPage() {
  return <LegacyImagesRoute />;
}
