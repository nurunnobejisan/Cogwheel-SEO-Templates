/**
 * Daily Session — Community Agent
 *
 * Finds one genuinely useful open-source activity and prepares a draft. This
 * agent never posts anything: every output ends at `approvalStatus:
 * "pending_review"` and requires explicit human approval before it leaves the
 * repository. It cannot read private or restricted code, and it will not invent
 * issues or meaningless pull requests.
 */

import "server-only";
import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { communityArtifactSchema, type CommunityArtifact, type DailySession } from "@/lib/daily-session/types";
import type { DailySessionConfig } from "@/lib/daily-session/config";

const SAFE_ACTIVITY_KINDS = [
  "documentation improvement",
  "beginner-friendly issue review",
  "contribution-guidelines review",
  "helpful technical response draft",
  "issue triage observation",
] as const;

export interface CommunityAgentInput {
  session: DailySession;
  config: DailySessionConfig;
}

export async function runCommunityAgent(input: CommunityAgentInput): Promise<CommunityArtifact> {
  const { config } = input;

  if (!isClaudeConfigured()) {
    return communityArtifactSchema.parse({
      opportunity: "",
      repository: null,
      draft: "",
      approvalStatus: "none",
      posted: false,
      state: "unavailable",
    });
  }

  const system = [
    "You are preparing ONE open-source community activity for review.",
    "Rules you must follow:",
    "- Never draft fake issues or low-value pull requests.",
    "- Never suggest copying code from any repository.",
    "- Prefer documentation, issue review, and thoughtful technical answers over activity metrics.",
    "- Respect that repositories have licenses and contribution guidelines.",
    "Answer with exactly these headings: ## Opportunity, ## Repository, ## Draft.",
    "Keep the draft under 200 words and mark it as a PROPOSAL awaiting approval.",
  ].join("\n");

  const prompt = [
    `Skills: Python, FastAPI, TypeScript, Next.js, AWS, technical SEO, structured data.`,
    `Build repository: ${config.build.repo ?? "not configured"}.`,
    "",
    "Identify one realistic, useful activity that could be prepared today.",
    "For 'Repository' name a well-known public project where this fits, or write",
    "'local' if it concerns our own repository only.",
  ].join("\n");

  let raw: string;
  try {
    raw = await generateClaudeText({ system, prompt, maxTokens: 1200, taskId: "daily-session-community" });
  } catch (error) {
    return communityArtifactSchema.parse({
      opportunity: `Community agent failed: ${error instanceof Error ? error.message : String(error)}`,
      repository: null,
      draft: "",
      approvalStatus: "none",
      posted: false,
      state: "blocked",
    });
  }

  const section = (heading: string): string => {
    const match = raw.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"));
    return (match?.[1] ?? "").trim();
  };

  const repository = section("Repository") || null;
  const kind = SAFE_ACTIVITY_KINDS.find((k) => section("Opportunity").toLowerCase().includes(k.split(" ")[0]));

  return communityArtifactSchema.parse({
    opportunity: section("Opportunity").slice(0, 1000) || "No suitable activity identified.",
    repository: repository && repository.toLowerCase() !== "local" ? repository.slice(0, 200) : null,
    draft: section("Draft").slice(0, 8000),
    approvalStatus: "pending_review",
    posted: false,
    state: kind ? "in_progress" : "in_progress",
  });
}
