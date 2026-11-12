-- Hilton SEO Studio — initial schema (Phase 1)
create extension if not exists "pgcrypto";

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null default '',
  brand text not null default '',
  city text not null,
  state char(2) not null,
  notes text not null default '',
  allowed_locations text[] not null default '{}',
  excluded_locations text[] not null default '{}',
  pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, city, state)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  template char(1) not null check (template in ('A', 'B')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'report_generated', 'copy_generated')),
  stats jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists runs_property_idx on public.runs(property_id, created_at desc);

create table if not exists public.run_keywords (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  keyword text not null,
  volume integer not null,
  kd numeric,
  cpc numeric,
  intent text,
  bucket_id text,
  bucket_name text,
  bucket_source text,
  source_group text,
  source_files text[] not null default '{}',
  role text not null check (role in ('primary', 'secondary', 'fill', 'reserve')),
  page_id text,
  flags text[] not null default '{}',
  unique (run_id, keyword)
);
create index if not exists run_keywords_run_role_idx on public.run_keywords(run_id, role);

create table if not exists public.run_matrix (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  page_id text not null,
  path text not null,
  title text not null,
  primary_keyword text,
  primary_volume integer,
  primary_kd numeric,
  secondary_keyword text,
  secondary_volume integer,
  secondary_kd numeric,
  flags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited')),
  approved_at timestamptz,
  unique (run_id, page_id)
);

-- RLS on; the app talks to Postgres only via server routes with the service-role key.
alter table public.properties enable row level security;
alter table public.runs enable row level security;
alter table public.run_keywords enable row level security;
alter table public.run_matrix enable row level security;

