import { describe, expect, it } from "vitest";
import {
  extractDomain,
  getImageExcelPath,
  getImageOptimizedJsonPath,
  loadSiteImagesOptimized,
} from "../src/generators/image-optimizer";

describe("ImageOptimizer TypeScript Bridge", () => {
  it("extracts clean domain hostname", () => {
    expect(extractDomain("https://example-hotel.com")).toBe("example-hotel.com");
    expect(extractDomain("http://www.example-hotel.com/rooms")).toBe("example-hotel.com");
    expect(extractDomain("example-hotel.com")).toBe("example-hotel.com");
  });

  it("resolves default deliverable paths", () => {
    const excelPath = getImageExcelPath("https://thenines.com");
    const jsonPath = getImageOptimizedJsonPath("https://thenines.com");

    expect(excelPath).toContain("output/thenines.com/04-image-optimization.xlsx");
    expect(jsonPath).toContain("output/thenines.com/site-images-optimized.json");
  });

  it("loads existing site-images-optimized.json if present", () => {
    const data = loadSiteImagesOptimized("https://thenines.com");
    if (data) {
      expect(data.domain).toBe("thenines.com");
      expect(Array.isArray(data.images)).toBe(true);
      data.images.forEach((img) => {
        expect(img.optimized_alt.length).toBeLessThanOrEqual(125);
      });
    }
  });
});
