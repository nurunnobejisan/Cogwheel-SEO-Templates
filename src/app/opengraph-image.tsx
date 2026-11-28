import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const alt = brand.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0f172a 0%, #14532d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            SG
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>{brand.name}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 32, color: "#bbf7d0", maxWidth: 900 }}>
          Hotel search, technical SEO and generative engine visibility in one workspace.
        </div>
        <div style={{ marginTop: 24, fontSize: 24, color: "#d1fae5" }}>{`By ${brand.owner}`}</div>
      </div>
    ),
    size,
  );
}
