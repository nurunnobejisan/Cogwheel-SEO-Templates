-- Hotel SEO Automation App — task_runs persistence (Phase 1)
-- Tracks executions of every registered SEO task per property so re-audits and reports can read earlier runs.

create table if not exists public.task_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  task_id text not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  status text not null default 'Not started' check (status in ('Not started', 'Running', 'Done', 'Flagged')),
  output_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_runs_property_task_idx
  on public.task_runs(property_id, task_id, created_at desc);

create index if not exists task_runs_task_created_idx
  on public.task_runs(task_id, created_at desc);

alter table public.task_runs enable row level security;
