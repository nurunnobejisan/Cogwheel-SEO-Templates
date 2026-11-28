import type { Metadata } from "next";
import { SearchConsoleClient } from "@/components/pages/SearchConsoleClient";

export const metadata: Metadata = {
  title: "Search Console & Cannibalization — SEO & GEO Studio",
};

export default function SearchConsolePage() {
  return <SearchConsoleClient />;
}
