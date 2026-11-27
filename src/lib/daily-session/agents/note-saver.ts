/**
 * Daily Session — Learning note persistence
 *
 * Writes the generated note into the configured `til` repository on a
 * `daily-session/YYYY-MM-DD` branch, ready for human review. It never pushes to
 * the default branch and never opens a pull request on its own.
 *
 * Failure is never silent: the artifact keeps `noteSaved: false` plus an
 * `noteBlockedReason` that states exactly what is missing.
 */

import "server-only";
import { loadDailySessionConfig, type DailySessionConfig } from "@/lib/daily-session/config";
import { createBranch, commitFile, GitHubUnavailable, RepoNotAuthorized } from "@/lib/daily-session/github";
import { renderNote, type LearningAgentInput } from "./learning";
import type { LearnArtifact } from "@/lib/daily-session/types";
import { fileStamp } from "@/lib/daily-session/types";

export interface SaveNoteResult {
  saved: boolean;
  path: string | null;
  reason: string | null;
  branch: string | null;
  commitUrl: string | null;
}

/**
 * Persist the note when possible. Idempotent by construction: if a note for
 * this topic already exists on today's branch we report it as saved rather
 * than creating a duplicate.
 */
export async function saveLearningNote(
  artifact: LearnArtifact,
  input: Pick<LearningAgentInput, "session">,
  config: DailySessionConfig = loadDailySessionConfig(),
): Promise<SaveNoteResult> {
  if (!config.learn.repo) {
    return { saved: false, path: null, reason: config.learn.setup, branch: null, commitUrl: null };
  }
  if (!config.githubToken) {
    return {
      saved: false,
      path: artifact.notePath,
      reason: "GITHUB_TOKEN is not set — the note was generated but not pushed. Add a token with Contents:RW to save it.",
      branch: null,
      commitUrl: null,
    };
  }
  if (!artifact.topic) {
    return { saved: false, path: null, reason: "no topic selected", branch: null, commitUrl: null };
  }

  const day = fileStamp();
  const branch = `daily-session/${day}`;
  const path = artifact.notePath ?? `${day}/${day}.md`;

  try {
    // Create the branch from the default branch; tolerate it already existing.
    try {
      const { inspectRepo } = await import("@/lib/daily-session/github");
      const repo = await inspectRepo(config.learn.repo, config);
      await createBranch(config.learn.repo, branch, repo.defaultBranch, config);
    } catch (error) {
      // Branch already exists (422) is expected on a second run — continue.
      if (!(error instanceof Error) || !/422|already exists/i.test(error.message)) {
        if (error instanceof RepoNotAuthorized || error instanceof GitHubUnavailable) throw error;
        // Any other ref error: fall through and attempt the commit anyway.
      }
    }

    const { htmlUrl } = await commitFile(
      config.learn.repo,
      branch,
      path,
      renderNote(artifact, day),
      `docs(daily-session): learning note — ${artifact.topic}`,
      config,
    );

    return { saved: true, path, reason: null, branch, commitUrl: htmlUrl };
  } catch (error) {
    if (error instanceof RepoNotAuthorized || error instanceof GitHubUnavailable) {
      return { saved: false, path, reason: error.message, branch: null, commitUrl: null };
    }
    return {
      saved: false,
      path,
      reason: `Could not save note: ${error instanceof Error ? error.message : String(error)}`,
      branch: null,
      commitUrl: null,
    };
  }
}
