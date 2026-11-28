import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  extractDomain,
  getMetaExcelPath,
  getMetaOptimizedJsonPath,
  loadSiteMetaOptimized,
} from "../src/generators/meta-optimizer";

describe("MetaOptimizer TypeScript Bridge", () => {
  it("extracts clean domain hostname correctly", () => {
    expect(extractDomain("https://example-hotel.com")).toBe("example-hotel.com");
    expect(extractDomain("http://www.example-hotel.com/rooms")).toBe("example-hotel.com");
    expect(extractDomain("example-hotel.com")).toBe("example-hotel.com");
  });

  it("computes default deliverable paths", () => {
    const excelPath = getMetaExcelPath("https://thenines.com");
    const jsonPath = getMetaOptimizedJsonPath("https://thenines.com");

    expect(excelPath).toContain("output/thenines.com/02-meta-title-description.xlsx");
    expect(jsonPath).toContain("output/thenines.com/site-meta-optimized.json");
  });

  it("loads existing site-meta-optimized.json when present", () => {
    const data = loadSiteMetaOptimized("https://thenines.com");
    if (data) {
      expect(data.domain).toBe("thenines.com");
      expect(data.pages.length).toBeGreaterThan(0);
      data.pages.forEach((p) => {
        expect(p.new_title.length).toBeLessThanOrEqual(60);
        expect(p.new_meta_description.length).toBeLessThanOrEqual(160);
      });
    }
  });
});
