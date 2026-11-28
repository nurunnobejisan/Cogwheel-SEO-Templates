import { notFound } from "next/navigation";
import { DevUiShowcase } from "./DevUiShowcase";

export const metadata = {
  title: "Design System & UI Kit — SEO & GEO Studio",
  robots: { index: false, follow: false },
};

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DevUiShowcase />;
}
