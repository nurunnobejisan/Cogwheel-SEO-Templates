import type { Metadata } from "next";
import { ContentStudioClient } from "@/components/pages/ContentStudioClient";

export const metadata: Metadata = {
  title: "Content Studio — SEO & GEO Studio",
};

export default function ContentStudioPage() {
  return <ContentStudioClient />;
}
