/**
 * Per-task adapter readiness (v2 WP3, D-036).
 *
 * The adapter's task scope comes from the active `status: "ready"` registry
 * entry's measured `readyTasks` — never from a hard-coded list and never from
 * hand-edited registry JSON without `ml.serve.register` provenance. With
 * today's registry (no ready entry) the adapter is used for **no task**.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// Scope override for the router wrapper (`isV1AdapterTask` reads the real
// registry JSON through this module; null keeps the real fail-closed read).
const adapterScope = vi.hoisted(() => ({ tasks: null as string[] | null }));

vi.mock("../src/core/ai/custom-model.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/ai/custom-model.ts")>();
  return {
    ...actual,
    isAdapterTaskReady: (task: string | undefined | null, registry?: unknown) =>
      adapterScope.tasks !== null
        ? adapterScope.tasks.includes(task ?? "")
        : actual.isAdapterTaskReady(task, registry as never),
  };
});

afterEach(() => {
  adapterScope.tasks = null;
});

import {
  getActiveReadyEntry,
  getAdapterReadyTasks,
  isAdapterTaskReady,
  type ModelRegistryShape,
} from "../src/core/ai/custom-model.ts";
import { isV1AdapterTask } from "../ai/router.ts";
import modelRegistryJson from "../data/models/model_registry.json";

const PROVENANCE = {
  by: "ml.serve.register",
  reportSha256: "c".repeat(64),
  measuredAt: "2026-11-29T00:00:00Z",
};

function registryWith(entries: ModelRegistryShape["models"], activeModelId?: string): ModelRegistryShape {
  return { activeModelId: activeModelId ?? null, models: entries };
}

describe("getActiveReadyEntry", () => {
  it("returns null when no registry entry is ready (today's registry)", () => {
    expect(getActiveReadyEntry(modelRegistryJson)).toBeNull();
    expect(getAdapterReadyTasks()).toEqual([]);
    // Therefore no task may reach the adapter, whatever its tier.
    expect(isAdapterTaskReady("schema_generation")).toBe(false);
    expect(isAdapterTaskReady("metadata_generation")).toBe(false);
    expect(isV1AdapterTask("schema_generation")).toBe(false);
    expect(isV1AdapterTask(undefined)).toBe(false);
  });

  it("prefers the activeModelId match among ready entries", () => {
    const registry = registryWith(
      [
        { modelId: "old", status: "ready", createdAt: "2026-01-01T00:00:00Z", readyTasks: ["schema_generation"], readyTasksProvenance: PROVENANCE },
        { modelId: "new", status: "ready", createdAt: "2026-02-01T00:00:00Z", readyTasks: ["metadata_generation"], readyTasksProvenance: PROVENANCE },
      ],
      "new",
    );
    expect(getActiveReadyEntry(registry)?.modelId).toBe("new");
    expect(getAdapterReadyTasks(registry)).toEqual(["metadata_generation"]);
  });
});

describe("fail-closed provenance rule", () => {
  const ready = (readyTasks: string[], provenance?: unknown): ModelRegistryShape =>
    registryWith([{ modelId: "m", status: "ready", readyTasks, ...(provenance ? { readyTasksProvenance: provenance as never } : {}) }]);

  it("ignores hand-edited readyTasks without provenance", () => {
    expect(getAdapterReadyTasks(ready(["schema_generation"]))).toEqual([]);
    expect(isAdapterTaskReady("schema_generation", ready(["schema_generation"]))).toBe(false);
  });

  it("ignores provenance from any writer other than ml.serve.register", () => {
    const registry = ready(["schema_generation"], { ...PROVENANCE, by: "hand-edit" });
    expect(getAdapterReadyTasks(registry)).toEqual([]);
  });

  it("ignores provenance with a malformed report sha or timestamp", () => {
    expect(
      getAdapterReadyTasks(ready(["schema_generation"], { ...PROVENANCE, reportSha256: "nothex" })),
    ).toEqual([]);
    expect(
      getAdapterReadyTasks(ready(["schema_generation"], { ...PROVENANCE, measuredAt: "not-a-date" })),
    ).toEqual([]);
  });

  it("honours measured readyTasks written by ml.serve.register", () => {
    const registry = ready(["schema_generation", "metadata_generation"], PROVENANCE);
    expect(getAdapterReadyTasks(registry)).toEqual(["schema_generation", "metadata_generation"]);
    expect(isAdapterTaskReady("schema_generation", registry)).toBe(true);
    // A task outside the measured scope never routes to the adapter.
    expect(isAdapterTaskReady("rag_synthesis", registry)).toBe(false);
    expect(isAdapterTaskReady("alt_text_generation", registry)).toBe(false);
  });
});

describe("tier graduation via the same measured path", () => {
  it("lets a Tier 2 task serve once it is measured ready — and only then", () => {
    const registry = registryWith([
      {
        modelId: "m",
        status: "ready",
        readyTasks: ["rag_synthesis"],
        readyTasksProvenance: PROVENANCE,
      },
    ]);
    // Tier 2 task, measured ready → eligible through the same wrapper the
    // router uses (no tier constraint remains).
    expect(isAdapterTaskReady("rag_synthesis", registry)).toBe(true);
    adapterScope.tasks = ["rag_synthesis"];
    expect(isV1AdapterTask("rag_synthesis" as never)).toBe(true);

    // Without the measured scope the same Tier 2 task is not eligible.
    adapterScope.tasks = null;
    expect(isV1AdapterTask("rag_synthesis" as never)).toBe(false);

    // And a scope hand-edited without provenance is ignored end to end.
    const handEdited = registryWith([
      { modelId: "m", status: "ready", readyTasks: ["rag_synthesis"] },
    ]);
    expect(getAdapterReadyTasks(handEdited)).toEqual([]);
    expect(isAdapterTaskReady("rag_synthesis", handEdited)).toBe(false);
  });
});
