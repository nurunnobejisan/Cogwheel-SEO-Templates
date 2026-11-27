# Daily Session

One button — **Start Daily Session** — runs a focused 60-minute routine:
**Learn 15m → Build 40m → Community 5m**.

Open it at [`/daily-session`](/daily-session).

## What it does

| Phase | Length | What happens |
| --- | --- | --- |
| **Learn** | 15 min | Picks a topic from your roadmap, explains it with a practical example, relates it to your project, asks a knowledge-check question, and saves a dated note to your `til` repository. |
| **Build** | 40 min | Inspects the configured build repository, selects one small complete task, produces an implementation plan on a `daily-session/YYYY-MM-DD-…` branch, and records real test results. |
| **Community** | 5 min | Identifies one useful open-source activity and prepares a draft. **Nothing is ever posted without your approval.** |

## Architecture

```text
/daily-session (page)
        │  GET /  POST /  PATCH /  POST /run
        ▼
┌─────────────────────────────────────────────────────────┐
│ app/api/daily-session/*      auth · zod validation      │
├─────────────────────────────────────────────────────────┤
│ lib/daily-session/                                     │
│   orchestrator.ts   state machine + server-side clock   │
│   store.ts          persistence (NDJSON / Supabase)     │
│   config.ts         repository allow-list (env)         │
│   github.ts         server-side GitHub client           │
│   agents/           learning · coding · community       │
│                     + note-saver                        │
└─────────────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
 platform/persistence        src/core/claude.ts
 (existing adapter)          (existing provider chain)
```

### Design rules

1. **One session at a time.** `start` returns the running session instead of creating a second, so a double-click cannot spawn duplicate work. The `processing` flag is *persisted*, not in-memory, so a refresh mid-transition still blocks a second job.
2. **Server-side timing only.** Elapsed time is derived from persisted `startedAt`/`endedAt`. The browser recomputes from those timestamps; it never increments a local counter. The app never claims work continued while it was closed.
3. **Honest results.** A phase cannot complete until its artifact is `done`. `testStatus` stays `not_run` until a suite actually executed, and Build refuses to complete while `testStatus === "failed"`.
4. **Repository allow-list.** Only `DAILY_SESSION_*_REPO` repositories are reachable. Anything else is rejected before it reaches the GitHub API — even if a model asks for a different repo.
5. **Approval before anything external.** Community drafts stop at `pending_review`. No auto-merge, no auto-post, no direct push to a default branch.

## Setup

Copy `.env.example` to `.env.local` and set only what you need:

```bash
DAILY_SESSION_BUILD_REPO=your-name/fastapi-lambda-starter
DAILY_SESSION_LEARN_REPO=your-name/til
DAILY_SESSION_RESEARCH_REPO=your-name/aws-ml-engineer-notes   # optional
GITHUB_TOKEN=github_pat_...                                    # fine-grained
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DAILY_SESSION_BUILD_REPO` | for Build | Repository the coding agent plans changes for |
| `DAILY_SESSION_LEARN_REPO` | for note saving | Repository receiving learning notes |
| `DAILY_SESSION_RESEARCH_REPO` | optional | Roadmap/notes the learning agent reads |
| `GITHUB_TOKEN` | for writes | Server-side token: `Contents:RW`, `Pull requests:RW` |
| `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` | optional | AI-authored plans; without one the agent produces a deterministic plan from real repository inspection |

**Without any configuration** the dashboard still loads and shows the exact
setup step for each phase — it never fabricates a repository.

## GitHub permissions

Use a **fine-grained** token scoped to the two repositories only:

- Contents: Read and write (branch + note commits)
- Pull requests: Read and write (PR preparation)

Never a classic PAT. The token is read server-side only, is not prefixed
`NEXT_PUBLIC_`, and is never echoed by any route.

## Session history & storage

Stored under the `daily_sessions` collection via the existing persistence
adapter — NDJSON locally (`data/daily-session/`), Supabase when
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set (required on Vercel, where
the filesystem is read-only).

Fields: session id, start/end timestamps, current phase, selected topic, task,
task status, test results, branch/PR references, note path, community draft,
errors, and the final report. No secrets are stored.

## Report

The end-of-session report separates **completed** from **proposed** work:

- **Learning** — topic, concepts, note link, knowledge-check result
- **Development** — task, files, tests executed, real results, branch/PR, remaining issues
- **Community** — repository, opportunity, draft, approval status
- **Overall** — actual minutes, completed phases, incomplete tasks, next recommended task

## Testing

```bash
npx vitest run tests/daily-session.test.ts   # 25 tests
npm test                                     # full suite
npm run typecheck
```

Covered: idempotent start, duplicate-session prevention, server-derived
elapsed time, pause freezing the clock, resume continuing from banked time,
phase transitions, honest completion gating (failed tests block Build), stale
optimistic-concurrency tokens, processing-latch recovery after failure,
reload/refresh persistence, note deduplication per day, and the repository
allow-list.

## Known limitations

- **Repository names in this deployment are not pre-set.** The three target
  repositories must be declared in `.env.local`; until then the corresponding
  phase reports `unavailable` with the variable to set.
- **Agent-produced changes are plans, not diffs.** The coding agent inspects
  real files and writes a scoped plan; applying and verifying the diff is a
  human-reviewed step. It never claims a test passed.
- **No background scheduler.** Phases advance on your action, not on wall-clock
  expiry, so a long agent run is never cut off mid-write.
- **Vercel filesystem is ephemeral** — set Supabase for durable history.
