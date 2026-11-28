/**
 * Human review queue — core domain (v2 WP1).
 *
 * Every row that a model or a teacher pipeline produced and that a human must
 * judge before it can become training or evaluation data. Three queues feed
 * the page:
 *
 *   golden_candidate    — draft golden-v2 cases awaiting an operator
 *   teacher_triple      — raw-tier teacher-drafted triples (audit → fix)
 *   shadow_disagreement — adapter vs free-chain disagreements captured in
 *                         AI_ADAPTER_MODE=shadow (WP3 producers)
 *
 * Invariants enforced here (v2 hard limits):
 *   - only a human action recorded through the operator API sets
 *     `reviewed: true` — there is no code path that auto-approves;
 *   - a rejected row is never training- or eval-eligible;
 *   - `edit_and_approve` keeps the original candidate output on the row as
 *     provenance (`originalOutput`), next to the approved edit (`output`).
 *
 * Pure functions only — persistence lives in `src/lib/review/store.ts`.
 */

export type ReviewQueueSource = "golden_candidate" | "teacher_triple" | "shadow_disagreement";

export type ReviewAction = "approve" | "edit_and_approve" | "reject";

export type ReviewDecisionStatus = "approved" | "rejected";

export interface GateResult {
  /** Gate identifier, e.g. `jsonld_valid`, `grounding`, `invented_metrics`. */
  gate: string;
  passed: boolean;
  detail?: string;
}

export interface ReviewRow {
  id: string;
  /** Id of the underlying record (triple id, golden case id, …), if any. */
  refId?: string;
  source: ReviewQueueSource;
  task?: string;
  input: unknown;
  candidateOutput: unknown;
  gateResults: GateResult[];
  /** Licence of the source the row was derived from, e.g. `Own`, `CC BY 4.0`. */
  sourceLicence: string;
  enqueuedAt: string;
  reviewed: false;
}

export interface ReviewedRow {
  id: string;
  refId?: string;
  source: ReviewQueueSource;
  task?: string;
  input: unknown;
  candidateOutput: unknown;
  gateResults: GateResult[];
  sourceLicence: string;
  enqueuedAt: string;
  reviewed: true;
  reviewer: string;
  reviewedAt: string;
  decision: ReviewDecisionStatus;
  action: ReviewAction;
  reason?: string;
  /** Approved output — the edited text for `edit_and_approve`. */
  output?: unknown;
  /** Provenance: the original candidate when an edit was approved. */
  originalOutput?: unknown;
}

export type AnyReviewRow = ReviewRow | ReviewedRow;

export const REVIEW_ACTIONS: readonly ReviewAction[] = [
  "approve",
  "edit_and_approve",
  "reject",
];

export const REVIEW_SOURCES: readonly ReviewQueueSource[] = [
  "golden_candidate",
  "teacher_triple",
  "shadow_disagreement",
];

export class ReviewRowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewRowError";
  }
}

/** True when the row has been approved by a human and may feed a builder. */
export function isTrainEligible(row: AnyReviewRow): boolean {
  return row.reviewed === true && row.decision === "approved";
}

function assertUnreviewed(row: AnyReviewRow): void {
  if (row.reviewed) {
    throw new ReviewRowError(`row ${row.id} is already reviewed — decisions are immutable`);
  }
}

function requireReviewer(reviewer: string | undefined): string {
  const id = (reviewer ?? "").trim();
  if (!id) {
    // Fail closed: no anonymous decisions. Only an authenticated operator
    // action may set `reviewed: true`.
    throw new ReviewRowError("a decision requires an authenticated reviewer id");
  }
  return id;
}

/**
 * Apply a human decision to a pending row.
 *
 * - `approve`          → decision approved, output stays the candidate.
 * - `edit_and_approve` → decision approved with `output` = editedOutput;
 *                        the untouched candidate is preserved as
 *                        `originalOutput` provenance.
 * - `reject`           → decision rejected; the row can never become a train
 *                        row (`isTrainEligible` is false forever).
 */
export function decideRow(
  row: AnyReviewRow,
  args: {
    action: ReviewAction;
    reviewer: string;
    now?: string;
    reason?: string;
    editedOutput?: unknown;
  },
): ReviewedRow {
  assertUnreviewed(row);
  const reviewer = requireReviewer(args.reviewer);
  const reviewedAt = args.now ?? new Date().toISOString();

  if (args.action === "reject") {
    return {
      ...row,
      reviewed: true,
      reviewer,
      reviewedAt,
      decision: "rejected",
      action: "reject",
      ...(args.reason ? { reason: args.reason } : {}),
    };
  }

  if (args.action === "edit_and_approve") {
    if (args.editedOutput === undefined || args.editedOutput === null) {
      throw new ReviewRowError("edit_and_approve requires an editedOutput");
    }
    if (JSON.stringify(args.editedOutput) === JSON.stringify(row.candidateOutput)) {
      throw new ReviewRowError(
        "edit_and_approve with an unchanged output is an approve — pass action: 'approve'",
      );
    }
    return {
      ...row,
      reviewed: true,
      reviewer,
      reviewedAt,
      decision: "approved",
      action: "edit_and_approve",
      output: args.editedOutput,
      originalOutput: row.candidateOutput,
      ...(args.reason ? { reason: args.reason } : {}),
    };
  }

  // approve
  return {
    ...row,
    reviewed: true,
    reviewer,
    reviewedAt,
    decision: "approved",
    action: "approve",
    output: row.candidateOutput,
    ...(args.reason ? { reason: args.reason } : {}),
  };
}

/** Count rows by review state for the queue header. */
export function queueStats(rows: AnyReviewRow[]): {
  pending: number;
  approved: number;
  rejected: number;
  bySource: Record<ReviewQueueSource, number>;
} {
  const bySource: Record<ReviewQueueSource, number> = {
    golden_candidate: 0,
    teacher_triple: 0,
    shadow_disagreement: 0,
  };
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const row of rows) {
    bySource[row.source] += 1;
    if (!row.reviewed) pending += 1;
    else if (row.decision === "approved") approved += 1;
    else rejected += 1;
  }
  return { pending, approved, rejected, bySource };
}

/** Parse one JSONL line into a row, refusing malformed input. */
export function parseReviewRow(line: string, lineNumber: number): AnyReviewRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new ReviewRowError(`review queue line ${lineNumber} is not valid JSON`);
  }
  const row = parsed as AnyReviewRow;
  if (!row || typeof row !== "object") {
    throw new ReviewRowError(`review queue line ${lineNumber} is not an object`);
  }
  if (typeof row.id !== "string" || !row.id) {
    throw new ReviewRowError(`review queue line ${lineNumber} needs a non-empty id`);
  }
  if (!REVIEW_SOURCES.includes(row.source)) {
    throw new ReviewRowError(
      `review queue line ${lineNumber} has unknown source ${String((row as { source?: unknown }).source)}`,
    );
  }
  return row;
}
