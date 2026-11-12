import { describe, expect, it } from "vitest";
import sitemap from "@/config/sitemap.json";
import { bucketKeywords } from "@/lib/engine/bucket";
import { ingestParsedFiles } from "@/lib/engine/ingest";
import { inlineEditMatrixKeyword, setRowStatus, updatePoolKeyword } from "@/lib/engine/matrix";
import { parseCsvText } from "@/lib/engine/parse";
import { runSelection } from "@/lib/engine/select";
import type { Property, SitemapPage } from "@/lib/types";

const property: Property = {
  name: "Hotel X Gainesville, Tapestry Collection by Hilton",
  url: "https://www.hilton.com/en/hotels/gnvxup-hotel-x/",
  brand: "Tapestry",
  city: "Gainesville",
  state: "FL",
  notes: "Rooftop bar opening Q2",
  allowedLocations: ["university of florida", "uf", "midtown"],
  excludedLocations: ["ocala"],
};

describe("Phase 1 & 2 keyword engine", () => {
  it("parses, dedupes, filters geo/volume, buckets, allocates, and supports inline edits", () => {
    const csv1 = [
      "Keyword,Volume,Keyword Difficulty",
      "hotels in gainesville fl,2400,32",
      "hotels in gainesville fl,1900,35",
      "boutique hotel gainesville,590,28",
      "rooftop bar gainesville,720,24",
      "hotels in miami fl,9900,40",
      "hotels in ocala,480,25",
      "tiny wedding venue gainesville,5,12",
      "random low volume query,5,30",
      "unscored suite gainesville,320,N/A",
    ].join("\n");

    const parsed = parseCsvText("gainesville_hotel_broad-match_us_2026-01-01.csv", csv1);
    const ingest = ingestParsedFiles([parsed], property);

    // miami (wrong city), ocala (excluded), random low volume (SV < 10) dropped; duplicate merged
    expect(ingest.stats.duplicatesMerged).toBe(1);
    expect(ingest.stats.dropped.geo).toBe(2);
    expect(ingest.stats.dropped["low-volume"]).toBe(1);
    expect(ingest.keywords.some((k) => k.keyword === "tiny wedding venue gainesville")).toBe(true);
    expect(ingest.keywords.find((k) => k.keyword === "unscored suite gainesville")?.kd).toBeNull();

    const bucketed = bucketKeywords(ingest.keywords);
    expect(bucketed.find((k) => k.keyword === "rooftop bar gainesville")?.bucketId).toBe("rooftop-bar");

    const pages = (sitemap.pages as SitemapPage[]).slice(0, 6);
    const { matrix, allocation } = runSelection(bucketed, pages, "B");
    expect(allocation.pool.length).toBeLessThanOrEqual(allocation.quota);
    expect(matrix.find((m) => m.pageId === "home")?.primary?.keyword).toBe("hotels in gainesville fl");

    const edited = inlineEditMatrixKeyword({ matrix, allocation }, "home", "primary", {
      keyword: "tapestry hotel gainesville",
      volume: 410,
      kd: 22,
    });
    expect(edited.matrix.find((m) => m.pageId === "home")?.primary?.keyword).toBe("tapestry hotel gainesville");
    expect(edited.matrix.find((m) => m.pageId === "home")?.status).toBe("edited");

    const poolEdited = updatePoolKeyword(edited, "kw:tapestry hotel gainesville", { volume: 450 });
    expect(poolEdited.matrix.find((m) => m.pageId === "home")?.primary?.volume).toBe(450);

    const approved = setRowStatus(poolEdited, "all", true);
    expect(approved.matrix.every((m) => m.status === "approved")).toBe(true);
  });
});

