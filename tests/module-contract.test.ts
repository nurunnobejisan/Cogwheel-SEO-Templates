import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMPLEMENTED_TASK_STATUSES,
  MissingDependencyError,
  REQUIRED_MODULE_FILES,
  summarizeTaskFlags,
} from "@/tasks/contract";
import { TASK_RUNNERS } from "@/tasks/registry";
import { TASKS_CONFIG } from "@/tasks/tasks.config";

const TASKS_DIR = path.resolve(process.cwd(), "src/tasks");

describe("Module Contract", () => {
  it("requires every Done/Built task in TASKS_CONFIG to be registered and have all contract files", () => {
    const implementedTasks = TASKS_CONFIG.filter((task) =>
      IMPLEMENTED_TASK_STATUSES.has(task.status),
    );

    expect(implementedTasks.length).toBeGreaterThan(0);

    for (const task of implementedTasks) {
      expect(
        TASK_RUNNERS[task.id],
        `Task "${task.id}" has status "${task.status}" but is not registered in TASK_RUNNERS`,
      ).toBeTypeOf("function");

      const taskDir = path.join(TASKS_DIR, task.id);
      expect(
        fs.existsSync(taskDir) && fs.statSync(taskDir).isDirectory(),
        `Missing task directory src/tasks/${task.id}/`,
      ).toBe(true);

      for (const fileName of REQUIRED_MODULE_FILES) {
        const filePath = path.join(taskDir, fileName);
        expect(
          fs.existsSync(filePath),
          `Task "${task.id}" is missing required contract file: src/tasks/${task.id}/${fileName}`,
        ).toBe(true);
      }

      const entries = fs.readdirSync(taskDir);
      const hasTestFile = entries.some((entry) => entry.endsWith(".test.ts"));
      expect(
        hasTestFile,
        `Task "${task.id}" is missing a *.test.ts file in src/tasks/${task.id}/`,
      ).toBe(true);
    }
  });

  it("provides MissingDependencyError and summarizeTaskFlags helpers", () => {
    const err = new MissingDependencyError("title-meta", "site-crawl");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MissingDependencyError");
    expect(err.message).toContain("title-meta");
    expect(err.message).toContain("site-crawl");

    const summary = summarizeTaskFlags([
      { code: "WARN_1", message: "Missing optional KR run", severity: "warning" },
      { code: "ERR_1", message: "Over char limit", severity: "error", section: "/rooms" },
    ]);
    expect(summary.totalFlags).toBe(2);
    expect(summary.hasWarnings).toBe(true);
    expect(summary.hasErrors).toBe(true);
  });
});
