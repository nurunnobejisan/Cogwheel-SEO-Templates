import type { Metadata } from "next";
import { AiTrainingClient } from "@/components/pages/AiTrainingClient";

export const metadata: Metadata = {
  title: "AI Training Rules — SEO & GEO Studio",
};

export default function AiTrainingSettingsPage() {
  return <AiTrainingClient />;
}
