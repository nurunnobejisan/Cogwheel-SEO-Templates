/**
 * Daily Session — Coding Agent
 *
 * The Build phase (40 minutes) is the important one, so this agent is
 * deliberately conservative:
 *
 *  1. Inspect the configured build repository (files, branch, open labels).
 *  2. Choose one small, complete, meaningful task.
 *  3. Produce an implementation plan scoped to that task only.
 *  4. Create a `daily-session/YYYY-MM-DD-...` branch and, when the change is a
 *     self-contained note/patch file, commit it for human review.
 *
 * It never pushes to the default branch, never merges, and never claims a test
 * passed. Actual code edits are proposed in `plan` + `summary` and left for
 * review — the agent does not fabricate a diff it did not verify.
 */

import "server-only";
import { generateClaudeText, getActiveAiProviderLabel, isClaudeConfigured } from "@/core/claude";
import { buildArtifactSchema, fileStamp, type BuildArtifact, type DailySession } from "@/lib/daily-session/types";
import type { DailySessionConfig } from "@/lib/daily-session/config";
import { GitHubUnavailable, inspectRepo, listRepoFiles, RepoNotAuthorized } from "@/lib/daily-session/github";

export interface CodingAgentInput {
  session: DailySession;
  config: DailySessionConfig;
}

/** Task catalogue: small, complete, meaningful — sized for one session. */
const TASK_CATALOGUE = [
  "Add request validation to one endpoint with Zod",
  "Improve error handling so failures return structured JSON",
  "Add unit tests for one uncovered module",
  "Fix a failing test",
  "Add or improve API documentation for one route",
  "Improve AWS Lambda compatibility (cold-start / packaging)",
  "Implement one DynamoDB operation with error handling",
  "Improve a GitHub Actions workflow (caching, timeouts)",
  "Refactor one duplicated block into a shared helper",
  "Add input sanitization to one user-supplied field",
] as const;

function branchNameFor(session: DailySession, slug: string): string {
  return `daily-session/${fileStamp()}-${slug}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function runCodingAgent(input: CodingAgentInput): Promise<BuildArtifact> {
  const { session, config } = input;

  // ── Configuration gate ────────────────────────────────────────────────
  if (!config.build.repo) {
    return buildArtifactSchema.parse({
      task: "",
      plan: [],
      branch: null,
      testStatus: "unavailable",
      summary: "",
      continuation: config.build.setup,
      state: "unavailable",
    });
  }

  // ── Repository inspection ─────────────────────────────────────────────
  let files: string[] = [];
  let openIssues = 0;
  let branch: string | null = null;
  let inspectionNote = "";

  try {
    const summary = await inspectRepo(config.build.repo, config);
    openIssues = summary.openIssues;
    const tree = await listRepoFiles(config.build.repo, "", config);
    files = tree.map((f) => f.path).slice(0, 200);
    branch = branchNameFor(session, "session-task");
    inspectionNote = `${summary.fullName} @ ${summary.defaultBranch}, ${files.length} top-level files, ${openIssues} open issues.`;
  } catch (error) {
    if (error instanceof RepoNotAuthorized || error instanceof GitHubUnavailable) {
      return buildArtifactSchema.parse({
        task: "",
        plan: [],
        branch: null,
        testStatus: "unavailable",
        summary: "",
        continuation: error.message,
        state: "unavailable",
      });
    }
    return buildArtifactSchema.parse({
      task: "",
      plan: [],
      branch: null,
      testStatus: "unavailable",
      summary: "",
      continuation: `Repository inspection failed: ${error instanceof Error ? error.message : String(error)}. Check DAILY_SESSION_BUILD_REPO and GITHUB_TOKEN.`,
      state: "blocked",
    });
  }

  // ── Task selection ────────────────────────────────────────────────────
  const seed = session.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + files.length;
  const task = session.build.task || TASK_CATALOGUE[seed % TASK_CATALOGUE.length];

  if (!isClaudeConfigured()) {
    // No AI provider: still deliver a deterministic, real plan from inspection.
    return buildArtifactSchema.parse({
      task,
      plan: [
        `Inspect ${files.slice(0, 5).join(", ") || "the repository tree"} to locate the target module.`,
        "Make the smallest change that satisfies the task.",
        "Add or update tests covering the changed behaviour.",
        "Run the existing test suite and lint, then record the real result.",
      ],
      branch,
      filesChanged: [],
      testsRun: "",
      testStatus: "not_run",
      summary: `AI provider unavailable (${getActiveAiProviderLabel()}). Deterministic plan generated from repository inspection: ${inspectionNote}`,
      continuation: "Set ANTHROPIC_API_KEY or GEMINI_API_KEY for an AI-authored plan.",
      state: "in_progress",
    });
  }

  const system = [
    "You are a senior engineer planning one small, complete development task.",
    "Rules:",
    "- Scope to ONE task that fits in a 40-minute session.",
    "- Never propose deleting existing features.",
    "- Never claim a test passed; the operator records real results.",
    "- Reference real file paths from the provided repository listing only.",
    "Answer with exactly these headings: ## Task, ## Plan (numbered), ## Files, ## Test strategy.",
  ].join("\n");

  const prompt = [
    `Repository: ${config.build.repo}`,
    `Inspection: ${inspectionNote}`,
    `Files (first 60): ${files.slice(0, 60).join(", ")}`,
    `Open issues: ${openIssues}`,
    `Candidate task: ${task}`,
    "",
    "Produce an implementation plan for this task in this repository.",
  ].join("\n");

  let raw: string;
  try {
    raw = await generateClaudeText({ system, prompt, maxTokens: 1600, taskId: "daily-session-build" });
  } catch (error) {
    return buildArtifactSchema.parse({
      task,
      plan: [],
      branch,
      testStatus: "not_run",
      summary: "",
      continuation: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
      state: "blocked",
    });
  }

  const section = (heading: string): string => {
    const match = raw.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"));
    return (match?.[1] ?? "").trim();
  };

  const plan = section("Plan")
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);

  const filesChanged = section("Files")
    .split(/[\n,]/)
    .map((f) => f.trim().replace(/[`*]/g, ""))
    .filter((f) => f.includes("/") || f.includes("."))
    .slice(0, 12);

  return buildArtifactSchema.parse({
    task,
    plan: plan.length ? plan : ["Locate the target module.", "Make the minimal change.", "Add tests.", "Run the suite and record the result."],
    branch,
    filesChanged,
    testsRun: "",
    testStatus: "not_run",
    summary: section("Test strategy") ? `Test strategy: ${section("Test strategy")}` : "",
    continuation: "",
    state: "in_progress",
  });
}

/**
 * Record the real outcome of a test run. Called only after the suite has
 * actually executed — the agent never sets `passed` on its own.
 */
export function recordTestResult(current: BuildArtifact, status: "passed" | "failed" | "not_run", output: string): BuildArtifact {
  return buildArtifactSchema.parse({
    ...current,
    testStatus: status,
    testsRun: output.slice(0, 2000),
    state: status === "passed" ? "done" : current.state,
  });
}
