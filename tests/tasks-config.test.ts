import { describe, expect, it } from "vitest";
import { getTaskConfig, getTasksBySection, TASK_SECTIONS, TASKS_CONFIG } from "@/tasks/tasks.config";

describe("tasks.config.ts", () => {
  it("registers all 22 tasks across the 5 required sections", () => {
    expect(TASK_SECTIONS).toEqual(["On Page", "Technical", "Off Page", "Local", "Reporting"]);
    expect(TASKS_CONFIG).toHaveLength(22);
    expect(getTasksBySection("On Page")).toHaveLength(8);
    expect(getTasksBySection("Technical")).toHaveLength(6);
    expect(getTasksBySection("Off Page")).toHaveLength(4);
    expect(getTasksBySection("Local")).toHaveLength(1);
    expect(getTasksBySection("Reporting")).toHaveLength(3);
  });

  it("has unique task IDs and valid dependency references", () => {
    const ids = new Set(TASKS_CONFIG.map((t) => t.id));
    expect(ids.size).toBe(TASKS_CONFIG.length);
    for (const task of TASKS_CONFIG) {
      for (const dep of task.dependsOn) {
        expect(ids.has(dep)).toBe(true);
      }
      expect(task.templateId).toMatch(/^GOOGLE_/);
    }
  });

  it("marks all 22 enterprise tasks as Done and fully implemented", () => {
    const doneTasks = TASKS_CONFIG.filter((t) => t.status === "Done");
    expect(doneTasks.length).toBe(22);
    expect(doneTasks.map((t) => t.id).sort()).toEqual([
      "ai-seo-visibility-report",
      "backlinking-strategy-execution",
      "competitors-backlink-analysis",
      "compsets-keywords-analysis",
      "duplicate-content-audit",
      "email-outreach-formatting",
      "final-seo-geo-project-report",
      "google-map-citation",
      "heading-structure",
      "image-optimization",
      "internal-kickoff-strategy-list",
      "keyword-ranking-report-comp-set",
      "keyword-research",
      "schema-markup",
      "seo-baseline-ai-visibility",
      "seo-only-visibility-report",
      "site-crawl",
      "site-tech-re-audit-report",
      "sitemap-navigation-optimization",
      "technical-audit",
      "title-meta",
      "usp-headline-optimization",
    ]);
  });

  it("retrieves individual task configs by ID", () => {
    const kr = getTaskConfig("keyword-research");
    expect(kr).toBeDefined();
    expect(kr?.name).toBe("Keyword Research");
    expect(kr?.outputType).toBe("doc");

    const sm = getTaskConfig("schema-markup");
    expect(sm).toBeDefined();
    expect(sm?.outputType).toBe("json");
  });
});
