import type { Metadata } from "next";
import { LegacyAiTrainingRoute } from "@/components/shell/LegacyRouteViews";

export const metadata: Metadata = {
  title: "AI Training Rules — SEO & GEO Studio",
};

export default function AiTrainingSettingsPage() {
  return <LegacyAiTrainingRoute />;
}
