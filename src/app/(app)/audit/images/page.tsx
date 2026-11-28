import type { Metadata } from "next";
import { ImagesAuditClient } from "@/components/pages/ImagesAuditClient";

export const metadata: Metadata = {
  title: "Image Optimization Audit — SEO & GEO Studio",
};

export default function AuditImagesPage() {
  return <ImagesAuditClient />;
}
