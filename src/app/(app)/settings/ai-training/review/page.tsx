import type { Metadata } from "next";
import { ReviewQueueClient } from "@/components/pages/ReviewQueueClient";

export const metadata: Metadata = {
  title: "Review Queue — SEO & GEO Studio",
};

export default function ReviewQueuePage() {
  return <ReviewQueueClient />;
}
