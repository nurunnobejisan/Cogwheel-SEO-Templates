import { describe, expect, it } from "vitest";
import { POST as runTaskPost } from "@/app/api/tasks/[taskId]/run/route";
import { GET as listRunsGet } from "@/app/api/tasks/[taskId]/runs/route";

describe("API /api/tasks/[taskId]", () => {
  it("returns 404 for unknown taskId on POST run and GET runs", async () => {
    const postRes = await runTaskPost(new Request("http://localhost/api/tasks/nonexistent/run", { method: "POST" }), {
      params: { taskId: "nonexistent" },
    });
    expect(postRes.status).toBe(404);

    const getRes = await listRunsGet(new Request("http://localhost/api/tasks/nonexistent/runs"), {
      params: { taskId: "nonexistent" },
    });
    expect(getRes.status).toBe(404);
  });

  it("returns 501 for Phase 2/3 tasks that are registered as Not started", async () => {
    const res = await runTaskPost(
      new Request("http://localhost/api/tasks/technical-audit/run", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: { taskId: "technical-audit" } },
    );
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.taskId).toBe("technical-audit");
    expect(json.phase).toBe(2);
  });

  it("returns 400 for invalid input on Phase 1 tasks", async () => {
    const krRes = await runTaskPost(
      new Request("http://localhost/api/tasks/keyword-research/run", {
        method: "POST",
        body: JSON.stringify({ invalid: true }),
      }),
      { params: { taskId: "keyword-research" } },
    );
    expect(krRes.status).toBe(400);

    const hcRes = await runTaskPost(
      new Request("http://localhost/api/tasks/usp-headline-optimization/run", {
        method: "POST",
        body: JSON.stringify({ invalid: true }),
      }),
      { params: { taskId: "usp-headline-optimization" } },
    );
    expect(hcRes.status).toBe(400);
  });

  it("returns runs list for valid taskId on GET /api/tasks/[taskId]/runs", async () => {
    const res = await listRunsGet(new Request("http://localhost/api/tasks/keyword-research/runs"), {
      params: { taskId: "keyword-research" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.taskId).toBe("keyword-research");
    expect(Array.isArray(json.runs)).toBe(true);
  });
});

