/**
 * Daily Session — Configuration Interface
 *
 * The Daily Session feature targets three repositories that must be supplied by
 * the operator. None of them are assumed to exist: when a repository is not
 * configured the corresponding agent reports `unavailable` with the exact setup
 * step, the same convention the rest of the product uses for unconnected
 * providers ("measure, label, or leave blank").
 *
 *   DAILY_SESSION_BUILD_REPO    primary repository the coding agent works in
 *   DAILY_SESSION_LEARN_REPO    repository that receives generated learning notes
 *   DAILY_SESSION_NOTES_REPO    alias of DAILY_SESSION_LEARN_REPO (optional)
 *   DAILY_SESSION_RESEARCH_REPO roadmap / notes the learning agent reads
 *   GITHUB_TOKEN                server-side token, never exposed to the client
 *
 * All values are read server-side only. Nothing here is prefixed
 * NEXT_PUBLIC_, so no repository name or token can reach browser code.
 */

export type SessionRepoRole = "build" | "learn" | "research";

export interface SessionRepoConfig {
  role: SessionRepoRole;
  /** `owner/name`, or null when the operator has not configured it. */
  repo: string | null;
  /** Human-readable setup step shown when the repo is missing. */
  setup: string;
}

export interface DailySessionConfig {
  build: SessionRepoConfig;
  learn: SessionRepoConfig;
  research: SessionRepoConfig;
  /** Server-side GitHub token. Null when absent — read-only fallback only. */
  githubToken: string | null;
  /** True when at least one repo is configured. */
  configured: boolean;
}

/** `owner/name` shape. Anything else is rejected before it reaches the API. */
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function normalizeRepo(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  return REPO_PATTERN.test(value) ? value : null;
}

/**
 * `env` accepts any key/value map so tests and callers can pass a literal
 * object without satisfying Node's full `ProcessEnv` shape.
 */
export function loadDailySessionConfig(env: Record<string, string | undefined> = process.env): DailySessionConfig {
  const learn = normalizeRepo(env.DAILY_SESSION_LEARN_REPO || env.DAILY_SESSION_NOTES_REPO);
  const build = normalizeRepo(env.DAILY_SESSION_BUILD_REPO);
  const research = normalizeRepo(env.DAILY_SESSION_RESEARCH_REPO);

  const token = (env.GITHUB_TOKEN ?? "").trim() || null;

  return {
    build: {
      role: "build",
      repo: build,
      setup: "Set DAILY_SESSION_BUILD_REPO=owner/name in .env.local to enable the Build phase.",
    },
    learn: {
      role: "learn",
      repo: learn,
      setup: "Set DAILY_SESSION_LEARN_REPO=owner/name in .env.local to save learning notes.",
    },
    research: {
      role: "research",
      repo: research,
      setup: "Set DAILY_SESSION_RESEARCH_REPO=owner/name to let the learning agent read your roadmap.",
    },
    githubToken: token,
    configured: Boolean(build || learn || research),
  };
}

/** Repositories the Daily Session feature is allowed to touch. */
export function configuredRepos(config: DailySessionConfig): string[] {
  return [config.build.repo, config.learn.repo, config.research.repo].filter(
    (repo): repo is string => Boolean(repo),
  );
}

/**
 * Reject any repository the operator did not configure. This is the guard that
 * stops an agent from writing to an unrelated repository even if a model
 * returns a different name.
 */
export function isAuthorizedRepo(config: DailySessionConfig, repo: string): boolean {
  return configuredRepos(config).includes(repo);
}
