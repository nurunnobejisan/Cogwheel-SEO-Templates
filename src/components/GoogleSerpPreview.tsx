"use client";

import { useMemo, useState } from "react";

interface Props {
  initialTitle?: string;
  initialMeta?: string;
  url?: string;
  propertyName?: string;
}

export function GoogleSerpPreview({
  initialTitle = "Oceanfront Boutique Hotel in Charleston, SC | Book Direct",
  initialMeta = "Experience luxury accommodations steps from the historic district. Enjoy rooftop dining, pet-friendly suites, and guaranteed best rates when you book direct.",
  url = "https://www.theharborviewhotel.com/suites",
  propertyName = "The Harborview Hotel",
}: Props) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [title, setTitle] = useState(initialTitle);
  const [meta, setMeta] = useState(initialMeta);

  const parsedUrl = useMemo(() => {
    try {
      const u = new URL(url);
      const cleanPath = u.pathname.replace(/\/$/, "").replace(/^\//, "").split("/").join(" › ");
      return {
        domain: u.hostname.replace(/^www\./, ""),
        displayPath: cleanPath ? ` › ${cleanPath}` : "",
      };
    } catch {
      return { domain: "hotelwebsite.com", displayPath: " › suites" };
    }
  }, [url]);

  const titleLength = title.length;
  const metaLength = meta.length;

  const titleStatus =
    titleLength >= 45 && titleLength <= 60
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : titleLength > 60
        ? "text-rose-700 bg-rose-50 border-rose-200"
        : "text-amber-700 bg-amber-50 border-amber-200";

  const metaStatus =
    metaLength >= 120 && metaLength <= 155
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : metaLength > 155
        ? "text-rose-700 bg-rose-50 border-rose-200"
        : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
            Visual SERP
          </span>
          <h3 className="font-display text-sm font-bold text-slate-900">
            Google Search Snippet Simulator
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`rounded-lg px-3 py-1 transition ${
                device === "mobile"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`rounded-lg px-3 py-1 transition ${
                device === "desktop"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Desktop
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60">
        <div
          className={`w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm font-sans transition-all ${
            device === "mobile" ? "max-w-md" : "max-w-2xl"
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-[#202124]">
                {propertyName}
              </div>
              <div className="text-[11px] text-[#4d5156] truncate">
                https://{parsedUrl.domain}{parsedUrl.displayPath}
              </div>
            </div>
          </div>

          <div className="mt-1">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-[#1a0dab] hover:underline text-[18px] leading-snug font-normal line-clamp-2"
            >
              {title || "Enter an SEO Title..."}
            </a>
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-[#4d5156] line-clamp-3">
            {meta || "Enter a Meta Description..."}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-semibold text-emerald-800">
              ✓ Direct Booking
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
              Best Rate Guarantee
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
              Free Wi-Fi
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 pt-1">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Page Title</label>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${titleStatus}`}
            >
              {titleLength} / 60 chars {titleLength > 60 ? "(Truncated on Google)" : ""}
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input text-xs"
            placeholder="SEO Title Tag..."
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Meta Description</label>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${metaStatus}`}
            >
              {metaLength} / 155 chars {metaLength > 155 ? "(Truncated on Google)" : ""}
            </span>
          </div>
          <input
            type="text"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            className="input text-xs"
            placeholder="Meta Description..."
          />
        </div>
      </div>
    </div>
  );
}

