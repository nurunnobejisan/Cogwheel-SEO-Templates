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

  it("returns 400 for invalid input on enterprise tasks", async () => {
    const sitemapRes = await runTaskPost(
      new Request("http://localhost/api/tasks/sitemap-navigation-optimization/run", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: { taskId: "sitemap-navigation-optimization" } },
    );
    expect(sitemapRes.status).toBe(400);

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

  it("handles valid options and returns structured task runner result", async () => {
    const getRes = await listRunsGet(new Request("http://localhost/api/tasks/technical-audit/runs"), {
      params: { taskId: "technical-audit" },
    });
    expect(getRes.status).toBe(200);
    const json = await getRes.json();
    expect(Array.isArray(json.runs)).toBe(true);
  });
});
