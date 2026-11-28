import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";
import { getTemplateBySlug } from "@/data/templates";

export const alt = "SEO & GEO Studio template";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ImageProps {
  params: { category: string; slug: string };
}

export default function TemplateOpengraphImage({ params }: ImageProps) {
  const template = getTemplateBySlug(params.category, params.slug);
  const title = template?.title ?? "SEO & GEO Studio Template";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0f172a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#86efac" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 700,
            }}
          >
            SG
          </div>
          {`${brand.name} · Template Library`}
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.15, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#cbd5e1" }}>
          {`${template?.category ?? "Hospitality SEO"} · By ${brand.owner}`}
        </div>
      </div>
    ),
    size,
  );
}
