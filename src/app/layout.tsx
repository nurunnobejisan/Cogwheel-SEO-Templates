import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hilton SEO/GEO Studio",
  description: "78-keyword pool builder, page-to-keyword approval matrix and Hilton content studio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
