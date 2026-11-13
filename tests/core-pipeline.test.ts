import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runTaskPipeline } from "@/core/pipeline";

describe("core/pipeline", () => {
  it("runs Inputs -> Fetch -> Claude -> Validate -> Render and returns Done when valid", async () => {
    const draftSpy = vi.fn(async () => ({ copy: "Valid grounded copy" }));

    const result = await runTaskPipeline({
      taskId: "test-task",
      schema: z.object({ name: z.string() }),
      rawInput: { name: "Hotel X" },
      fetchData: async (input) => ({ source: input.name }),
      draftWithClaude: draftSpy,
      validate: async ({ draft }) => ({ valid: draft.copy.length > 0, flags: [] }),
      renderTemplate: async ({ draft }) => ({
        outputUrl: "https://docs.google.com/document/d/abc/edit",
        output: draft,
      }),
    });

    expect(result.status).toBe("Done");
    expect(result.retries).toBe(0);
    expect(result.outputUrl).toBe("https://docs.google.com/document/d/abc/edit");
    expect(result.flags).toEqual([]);
    expect(draftSpy).toHaveBeenCalledTimes(1);
  });

  it("auto-retries up to 2x on validation failure, then succeeds if fixed", async () => {
    let calls = 0;
    const result = await runTaskPipeline({
      taskId: "test-retry-pass",
      schema: z.object({ name: z.string() }),
      rawInput: { name: "Hotel X" },
      fetchData: async () => ({}),
      draftWithClaude: async ({ feedback }) => {
        calls += 1;
        if (calls < 3) return { text: "too long" };
        expect(feedback).toEqual(["Exceeds 5 chars"]);
        return { text: "ok" };
      },
      validate: async ({ draft }) =>
        draft.text.length <= 5
          ? { valid: true, flags: [] }
          : { valid: false, flags: [{ code: "too-long", message: "Exceeds 5 chars", severity: "error" }] },
      renderTemplate: async ({ draft }) => ({ outputUrl: "https://example.com/doc", output: draft }),
    });

    expect(calls).toBe(3); // 1 initial + 2 retries
    expect(result.retries).toBe(2);
    expect(result.status).toBe("Done");
  });

  it("marks status Flagged when validation still fails after 2 retries", async () => {
    let calls = 0;
    const result = await runTaskPipeline({
      taskId: "test-retry-flag",
      schema: z.object({ name: z.string() }),
      rawInput: { name: "Hotel X" },
      fetchData: async () => ({}),
      draftWithClaude: async () => {
        calls += 1;
        return { text: "still invalid" };
      },
      validate: async () => ({
        valid: false,
        flags: [{ code: "rule-violation", message: "Still violates rule", severity: "error" }],
      }),
      renderTemplate: async ({ draft }) => ({ outputUrl: null, output: draft }),
    });

    expect(calls).toBe(3);
    expect(result.retries).toBe(2);
    expect(result.status).toBe("Flagged");
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].code).toBe("rule-violation");
  });
});
