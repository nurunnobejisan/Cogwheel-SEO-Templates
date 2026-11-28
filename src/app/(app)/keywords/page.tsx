import type { Metadata } from "next";
import { KeywordsPageClient } from "@/components/pages/KeywordsPageClient";

export const metadata: Metadata = {
  title: "Keyword Research — SEO & GEO Studio",
};

export default function KeywordsPage() {
  return <KeywordsPageClient />;
}
