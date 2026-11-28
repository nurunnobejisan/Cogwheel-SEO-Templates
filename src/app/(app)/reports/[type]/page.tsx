import type { Metadata } from "next";
import { LegacyReportsRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "Deliverable Studio — SEO & GEO Studio",
};

const VALID_TABS = new Set(["pptx", "slides", "preview", "memo", "email", "deck"]);

export default function ReportTypePage({ params }: { params: { type: string } }) {
  const initialTab = (VALID_TABS.has(params.type) ? params.type : "deck") as
    | "pptx"
    | "slides"
    | "preview"
    | "memo"
    | "email"
    | "deck";
  return <LegacyReportsRoute initialTab={initialTab} />;
}
