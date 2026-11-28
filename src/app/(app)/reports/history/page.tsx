import type { Metadata } from "next";
import { ReportsHistoryClient } from "@/components/pages/ReportsHistoryClient";

export const metadata: Metadata = {
  title: "Run History — SEO & GEO Studio",
};

export default function ReportsHistoryPage() {
  return <ReportsHistoryClient />;
}
