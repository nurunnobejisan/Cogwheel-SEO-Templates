-- Site Crawl shared infrastructure tables (crawl_runs & crawl_pages)
-- Stores chunked-batch crawl state, per-site diagnostics, and full per-page extracted facts.

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  task_run_id uuid references public.task_runs(id) on delete set null,
  start_url text not null,
  max_pages integer not null default 150,
  crawl_depth integer not null default 4,
  include_patterns text[] not null default '{}',
  exclude_patterns text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pages_discovered integer not null default 0,
  pages_crawled integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  queue_state jsonb not null default '{}'::jsonb,
  site_summary jsonb not null default '{}'::jsonb
);

create index if not exists crawl_runs_property_idx
  on public.crawl_runs(property_id, started_at desc);

create table if not exists public.crawl_pages (
  id bigint generated always as identity primary key,
  crawl_run_id uuid not null references public.crawl_runs(id) on delete cascade,
  url text not null,
  final_url text not null,
  status_code integer not null,
  redirect_chain jsonb not null default '[]'::jsonb,
  canonical text,
  robots_meta text,
  title text,
  meta_description text,
  h1_h6 jsonb not null default '[]'::jsonb,
  word_count integer not null default 0,
  content_hash text not null default '',
  images jsonb not null default '[]'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  external_links jsonb not null default '[]'::jsonb,
  hreflang jsonb not null default '[]'::jsonb,
  json_ld jsonb not null default '[]'::jsonb,
  open_graph jsonb not null default '{}'::jsonb,
  response_time_ms integer not null default 0,
  depth integer not null default 0,
  in_sitemap boolean not null default false,
  needs_js_rendering boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  crawled_at timestamptz not null default now(),
  unique (crawl_run_id, url)
);

create index if not exists crawl_pages_run_idx
  on public.crawl_pages(crawl_run_id, status_code);

alter table public.crawl_runs enable row level security;
alter table public.crawl_pages enable row level security;
