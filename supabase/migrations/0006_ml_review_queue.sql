-- 0006 — Human review queue (v2 WP1)
--
-- Mirror of the local `ml-review-queue.jsonl` store (src/lib/review/store.ts)
-- for the deployed Supabase path. Only an authenticated operator action may
-- set reviewed = true; the schema keeps decisions immutable by convention
-- (the API refuses second decisions) and keeps rejected rows permanently
-- ineligible for training exports.

create table if not exists ml_review_queue (
  id text primary key,
  ref_id text,
  source text not null check (source in ('golden_candidate', 'teacher_triple', 'shadow_disagreement')),
  task text,
  input jsonb not null,
  candidate_output jsonb not null,
  gate_results jsonb not null default '[]'::jsonb,
  source_licence text not null default 'Own',
  enqueued_at timestamptz not null default now(),
  reviewed boolean not null default false,
  reviewer text,
  reviewed_at timestamptz,
  decision text check (decision in ('approved', 'rejected')),
  action text check (action in ('approve', 'edit_and_approve', 'reject')),
  reason text,
  -- Approved output; for edit_and_approve this is the edited text and
  -- candidate_output is retained as provenance.
  output jsonb,
  original_output jsonb
);

create index if not exists ml_review_queue_source_idx
  on ml_review_queue (source, reviewed);

create index if not exists ml_review_queue_ref_idx
  on ml_review_queue (ref_id);

comment on table ml_review_queue is
  'Human review queue for golden-v2 candidates, teacher triples and shadow-mode disagreements. Only operator actions set reviewed = true; rejected rows never become training data.';
