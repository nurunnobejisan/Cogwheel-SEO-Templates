-- SEO Studio — AI Visibility (GEO) runs, answers and metrics (Phase 3)
-- Measures whether a brand appears and is cited in AI assistant answers
-- to Bangla, English and Banglish queries.

create table if not exists public.geo_visibility_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  pack_id text not null default 'bangladesh-hotels',
  n_runs integer not null default 3,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  notes text not null default ''
);

create table if not exists public.geo_visibility_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.geo_visibility_runs(id) on delete cascade,
  intent_id text not null,
  language text not null check (language in ('en', 'bn', 'banglish')),
  run_index integer not null default 0,
  query text not null,
  answer_text text not null default '',
  citations jsonb not null default '[]'::jsonb,
  raw_path text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists geo_visibility_answers_run_idx
  on public.geo_visibility_answers(run_id, intent_id, language);

create table if not exists public.geo_visibility_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.geo_visibility_runs(id) on delete cascade,
  entity text not null,
  provider text not null,
  language text not null check (language in ('en', 'bn', 'banglish')),
  week text not null default '',
  n_runs integer not null default 0,
  mention_rate numeric not null default 0,
  first_mention_share numeric not null default 0,
  citation_share numeric not null default 0,
  language_gap numeric not null default 0,
  rates_by_language jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, entity, provider, language)
);

create index if not exists geo_visibility_metrics_run_idx
  on public.geo_visibility_metrics(run_id, entity, provider);

alter table public.geo_visibility_runs enable row level security;
alter table public.geo_visibility_answers enable row level security;
alter table public.geo_visibility_metrics enable row level security;
