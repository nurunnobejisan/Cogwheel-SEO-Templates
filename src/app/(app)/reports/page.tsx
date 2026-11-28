import type { Metadata } from "next";
import { ReportsGalleryClient } from "@/components/pages/ReportsGalleryClient";

export const metadata: Metadata = {
  title: "Reports & Deliverables — SEO & GEO Studio",
};

export default function ReportsPage() {
  return <ReportsGalleryClient />;
}
