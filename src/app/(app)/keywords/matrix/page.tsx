import type { Metadata } from "next";
import { KeywordMatrixClient } from "@/components/pages/KeywordMatrixClient";

export const metadata: Metadata = {
  title: "Keyword Matrix Studio — SEO & GEO Studio",
};

export default function KeywordMatrixPage() {
  return <KeywordMatrixClient />;
}
