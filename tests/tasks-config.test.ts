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

  it("marks implemented tasks as Done and remaining Phase 2/3 tasks as Not started", () => {
    const doneTasks = TASKS_CONFIG.filter((t) => t.status === "Done");
    expect(doneTasks.map((t) => t.id).sort()).toEqual([
      "heading-structure",
      "keyword-research",
      "seo-baseline-ai-visibility",
      "seo-only-visibility-report",
      "site-crawl",
      "title-meta",
      "usp-headline-optimization",
    ]);

    const other = TASKS_CONFIG.filter((t) => t.status !== "Done");
    for (const t of other) {
      expect(t.status).toBe("Not started");
    }
    expect(getTaskConfig("keyword-research")?.outputType).toBe("doc");
    expect(getTaskConfig("usp-headline-optimization")?.outputType).toBe("doc");
  });
});

