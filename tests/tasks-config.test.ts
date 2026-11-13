import { describe, expect, it } from "vitest";
import { getTaskConfig, getTasksBySection, TASK_SECTIONS, TASKS_CONFIG } from "@/tasks/tasks.config";

describe("tasks.config.ts", () => {
  it("registers all 21 tasks across the 5 required sections", () => {
    expect(TASK_SECTIONS).toEqual(["On Page", "Technical", "Off Page", "Local", "Reporting"]);
    expect(TASKS_CONFIG).toHaveLength(21);
    expect(getTasksBySection("On Page")).toHaveLength(8);
    expect(getTasksBySection("Technical")).toHaveLength(5);
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

  it("marks only Phase 1 tasks as implemented/Done and all Phase 2/3 tasks as Not started", () => {
    const phase1 = TASKS_CONFIG.filter((t) => t.phase === 1);
    expect(phase1.map((t) => t.id).sort()).toEqual(["keyword-research", "usp-headline-optimization"]);

    const other = TASKS_CONFIG.filter((t) => t.phase !== 1);
    for (const t of other) {
      expect(t.status).toBe("Not started");
    }
    expect(getTaskConfig("keyword-research")?.outputType).toBe("doc");
    expect(getTaskConfig("usp-headline-optimization")?.outputType).toBe("doc");
  });
});
