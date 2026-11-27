/**
 * Daily Session — Learning Agent
 *
 * Picks one practical topic from the operator's stated roadmap, explains it,
 * relates it to the configured project, writes a knowledge-check question, and
 * saves a dated note into the `til` repository.
 *
 * Honesty rules:
 *  - Without an AI provider the phase reports `unavailable` with the reason.
 *  - Without a configured notes repo the note becomes a downloadable draft and
 *    `noteBlockedReason` says exactly what to set.
 *  - A note for the same topic on the same day is never written twice.
 */

import "server-only";
import { generateClaudeText, getActiveAiProviderLabel, isClaudeConfigured } from "@/core/claude";
import type { DailySession, LearnArtifact } from "@/lib/daily-session/types";
import { learnArtifactSchema, fileStamp } from "@/lib/daily-session/types";
import type { DailySessionConfig } from "@/lib/daily-session/config";

/** Candidate subjects, ordered by the operator's stated preparation goals. */
const TOPIC_POOL = [
  "Python type hints and dataclasses in service code",
  "FastAPI dependency injection and request validation",
  "AWS Lambda cold starts, packaging and handler design",
  "DynamoDB single-table design and access patterns",
  "AWS ML Engineer: model deployment and endpoint monitoring",
  "AWS ML Engineer: data transformation pipelines",
  "LangChain chains, memory and structured output",
  "Pytest fixtures, parametrization and mocking",
  "Cloud architecture: retries, idempotency and backoff",
  "CI/CD deployment strategies and rollbacks",
] as const;

export interface LearningAgentInput {
  session: DailySession;
  config: DailySessionConfig;
}

/** Deterministic pick so a resumed session keeps its topic. */
function selectTopic(session: DailySession): string {
  if (session.learn.topic) return session.learn.topic;
  const seed = session.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TOPIC_POOL[seed % TOPIC_POOL.length];
}

function blockedNote(config: DailySessionConfig): Pick<LearnArtifact, "noteSaved" | "notePath" | "noteBlockedReason"> {
  if (!config.learn.repo) {
    return { noteSaved: false, notePath: null, noteBlockedReason: config.learn.setup };
  }
  return { noteSaved: false, notePath: null, noteBlockedReason: null };
}

export async function runLearningAgent(input: LearningAgentInput): Promise<LearnArtifact> {
  const { session, config } = input;
  const topic = selectTopic(session);

  if (!isClaudeConfigured()) {
    return learnArtifactSchema.parse({
      topic,
      explanation: "",
      example: "",
      projectRelation: "",
      knowledgeCheck: "",
      notePath: null,
      noteSaved: false,
      noteBlockedReason: `No AI provider configured (active: ${getActiveAiProviderLabel()}). Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local.`,
      state: "unavailable",
    });
  }

  const day = fileStamp();
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const notePath = config.learn.repo
    ? `${slug}/${day}-${slug}.md`
    : null;

  const system = [
    "You are a senior engineer preparing a 15-minute learning note for one developer.",
    "Be concrete and practical. No filler, no marketing language.",
    "If something is uncertain or version-dependent, say so explicitly rather than guessing.",
    "Structure your answer with exactly these markdown headings:",
    "## Topic", "## Explanation", "## Practical example", "## Relation to the project", "## Knowledge check",
  ].join("\n");

  const prompt = [
    `Topic: ${topic}`,
    `Today: ${day}`,
    `Developer background: FastAPI, AWS Lambda, DynamoDB, AWS ML Engineer preparation.`,
    `Primary project: ${config.build.repo ?? "not configured yet"}.`,
    `Research/roadmap repo: ${config.research.repo ?? "not configured"}.`,
    "",
    "Explain the topic in under 200 words, give one runnable-style example,",
    "then relate it to a FastAPI + Lambda project in under 80 words,",
    "then ask exactly one short knowledge-check question with the answer.",
  ].join("\n");

  let raw: string;
  try {
    raw = await generateClaudeText({ system, prompt, maxTokens: 1600, taskId: "daily-session-learn" });
  } catch (error) {
    return learnArtifactSchema.parse({
      topic,
      ...blockedNote(config),
      state: "blocked",
      explanation: `Learning agent failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const section = (heading: string): string => {
    const match = raw.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"));
    return (match?.[1] ?? "").trim();
  };

  const artifact = learnArtifactSchema.parse({
    topic,
    explanation: section("Explanation") || raw.slice(0, 4000),
    example: section("Practical example"),
    projectRelation: section("Relation to the project"),
    knowledgeCheck: section("Knowledge check"),
    notePath,
    noteSaved: false,
    noteBlockedReason: config.learn.repo ? null : config.learn.setup,
    state: "in_progress",
  });

  // Saving is handled by the GitHub integration layer; when that layer cannot
  // run (no repo, no token) the artifact keeps an explicit blocked reason.
  return artifact;
}

/** Render the markdown note body once saving is possible. */
export function renderNote(artifact: LearnArtifact, day = fileStamp()): string {
  return [
    `# ${artifact.topic}`,
    "",
    `> Daily Session learning note — ${day}`,
    "",
    "## Explanation",
    artifact.explanation || "_Pending_",
    "",
    "## Practical example",
    artifact.example || "_Pending_",
    "",
    "## Relation to the project",
    artifact.projectRelation || "_Pending_",
    "",
    "## Knowledge check",
    artifact.knowledgeCheck || "_Pending_",
    "",
    "---",
    "_Generated by the Daily Session learning agent. Verify anything marked uncertain against official documentation._",
    "",
  ].join("\n");
}
