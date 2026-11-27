/**
 * Daily Session — GitHub client
 *
 * Server-side only. Token never leaves this module, is never logged, and is
 * never prefixed NEXT_PUBLIC_. Every write path checks `isAuthorizedRepo` first
 * so an agent cannot touch a repository the operator did not configure.
 *
 * Without a token the client still works read-only against public repos; write
 * operations return a clear `GitHubUnavailable` explaining what to set.
 */

import "server-only";
import { loadDailySessionConfig, isAuthorizedRepo, type DailySessionConfig } from "@/lib/daily-session/config";

const API = "https://api.github.com";
const USER_AGENT = "seo-studio-daily-session";

export class GitHubUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubUnavailable";
  }
}

export class RepoNotAuthorized extends Error {
  constructor(repo: string) {
    super(`Repository "${repo}" is not in the Daily Session allow-list. Set DAILY_SESSION_*_REPO to authorize it.`);
    this.name = "RepoNotAuthorized";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Require a token even for GET (used before writes). */
  requireAuth?: boolean;
}

async function gh<T>(path: string, config: DailySessionConfig, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, requireAuth = false } = options;

  if (requireAuth && !config.githubToken) {
    throw new GitHubUnavailable(
      "GITHUB_TOKEN is not set. Add a fine-grained token with Contents:RW and Pull requests:RW to .env.local to enable this action.",
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${detail.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface RepoSummary {
  fullName: string;
  defaultBranch: string;
  openIssues: number;
  description: string;
  language: string;
}

/** Read-only repository inspection used to pick a build task. */
export async function inspectRepo(repo: string, config = loadDailySessionConfig()): Promise<RepoSummary> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const data = await gh<{
    full_name: string;
    default_branch: string;
    open_issues_count: number;
    description: string | null;
    language: string | null;
  }>(`/repos/${repo}`, config);

  return {
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    openIssues: data.open_issues_count,
    description: data.description ?? "",
    language: data.language ?? "",
  };
}

export interface RepoFile {
  path: string;
  sha: string;
}

/** Top-level tree of an authorized repo (path-limited to keep it cheap). */
export async function listRepoFiles(repo: string, path = "", config = loadDailySessionConfig()): Promise<RepoFile[]> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const data = await gh<{ tree: { path: string; sha: string; type: string }[] }>(
    `/repos/${repo}/git/trees/${encodeURIComponent(path || "HEAD")}?recursive=0`,
    config,
  );
  return data.tree.filter((t) => t.type === "blob").map((t) => ({ path: t.path, sha: t.sha }));
}

export async function readIssueLabels(repo: string, config = loadDailySessionConfig()): Promise<string[]> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const data = await gh<{ name: string }[]>(`/repos/${repo}/issues?state=open&per_page=30`, config);
  return [...new Set(data.map((i) => i.name))];
}

export async function createBranch(repo: string, newBranch: string, fromBranch: string, config = loadDailySessionConfig()): Promise<void> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const ref = await gh<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`, config);
  await gh(`/repos/${repo}/git/refs`, config, {
    method: "POST",
    requireAuth: true,
    body: { ref: `refs/heads/${newBranch}`, sha: ref.object.sha },
  });
}

export async function commitFile(
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string,
  config = loadDailySessionConfig(),
): Promise<{ sha: string; htmlUrl: string }> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);

  let existingSha: string | null = null;
  try {
    const existing = await gh<{ sha: string }>(
      `/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`,
      config,
    );
    existingSha = existing.sha;
  } catch {
    existingSha = null;
  }

  const result = await gh<{ content: { sha: string }; commit: { html_url: string } }>(
    `/repos/${repo}/contents/${encodeURIComponent(filePath)}`,
    config,
    {
      method: "PUT",
      requireAuth: true,
      body: {
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      },
    },
  );

  return { sha: result.content.sha, htmlUrl: result.commit.html_url };
}

export async function createPullRequest(
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string,
  config = loadDailySessionConfig(),
): Promise<{ number: number; htmlUrl: string }> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const data = await gh<{ number: number; html_url: string }>(`/repos/${repo}/pulls`, config, {
    method: "POST",
    requireAuth: true,
    body: { title, head, base, body },
  });
  return { number: data.number, htmlUrl: data.html_url };
}

/** Files changed on the active branch — used by the session report. */
export async function listBranchCommits(repo: string, branch: string, config = loadDailySessionConfig()): Promise<string[]> {
  if (!isAuthorizedRepo(config, repo)) throw new RepoNotAuthorized(repo);
  const data = await gh<{ files?: { filename: string }[] }>(
    `/repos/${repo}/commits/${encodeURIComponent(branch)}?per_page=1`,
    config,
  );
  return (data.files ?? []).map((f) => f.filename);
}
