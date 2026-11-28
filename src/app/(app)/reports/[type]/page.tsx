import type { Metadata } from "next";
import { ReportTypeClient } from "@/components/pages/ReportTypeClient";

export const metadata: Metadata = {
  title: "Deliverable Studio — SEO & GEO Studio",
};

export default function ReportTypePage({ params }: { params: { type: string } }) {
  return <ReportTypeClient reportType={params.type} />;
}
