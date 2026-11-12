import { describe, expect, it } from "vitest";
import { detectColumns, parseCsvText, parseJsonText } from "@/lib/engine/parse";

describe("parse engine", () => {
  it("detects canonical column aliases case-insensitively with BOM", () => {
    const cols = detectColumns(["\uFEFFTop Queries", "Avg. Monthly Searches", "KD %", "CPC (USD)", "Topic"]);
    expect(cols).toEqual({
      keyword: 0,
      volume: 1,
      kd: 2,
      cpc: 3,
      group: 4,
    });
  });

  it("parses CSV with Group column and skips blank rows", () => {
    const csv = [
      "Note: Exported from Semrush",
      "Keyword;Volume;Keyword Difficulty;Group",
      "denver hotels;12000;59;Denver Hotels",
      ";;;",
      "rooftop bar denver;1600;29;Rooftop Bar Denver",
    ].join("\n");

    const parsed = parseCsvText("export.csv", csv);
    expect(parsed.usedGroupColumn).toBe(true);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      keyword: "denver hotels",
      volume: "12000",
      kd: "59",
      group: "Denver Hotels",
    });
  });

  it("falls back to headerless single-column keyword lists", () => {
    const parsed = parseCsvText("Ball Arena.txt", "hotel near ball arena\nball arena hotels\n");
    expect(parsed.usedGroupColumn).toBe(false);
    expect(parsed.sourceGroup).toBe("Ball Arena");
    expect(parsed.rows.map((r) => r.keyword)).toEqual(["hotel near ball arena", "ball arena hotels"]);
  });

  it("parses JSON keyword arrays and objects", () => {
    const json = JSON.stringify({
      keywords: [
        { query: "gainesville hotels", searchVolume: 2400, difficulty: 45, bucket: "Gainesville Hotels" },
        { keyword: "", volume: 100 },
      ],
    });
    const parsed = parseJsonText("gainesville.json", json);
    expect(parsed.usedGroupColumn).toBe(true);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      keyword: "gainesville hotels",
      volume: 2400,
      kd: 45,
      group: "Gainesville Hotels",
    });
  });
});

