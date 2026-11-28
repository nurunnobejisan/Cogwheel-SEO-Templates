-- SEO Studio Enterprise Platform: Multi-Client, Competitors, Backlinks, and Task Management
-- Migration: 0005_enterprise_clients.sql

-- 1. Agency Clients Table
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text default '',
  contact_name text default '',
  industry text default 'Hospitality',
  status text not null default 'active' check (status in ('active', 'archived', 'onboarding')),
  property_count integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Add client_id and enterprise property fields to properties table
alter table public.properties 
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists group_name text default '',
  add column if not exists property_type text default 'Hotel',
  add column if not exists market text default '',
  add column if not exists address text default '',
  add column if not exists country text default 'US',
  add column if not exists phone text default '',
  add column if not exists email text default '',
  add column if not exists target_audience text[] default '{}',
  add column if not exists amenities text[] default '{}',
  add column if not exists dining_info text[] default '{}',
  add column if not exists room_info text[] default '{}',
  add column if not exists meeting_event_info text[] default '{}',
  add column if not exists sitemap_urls text[] default '{}',
  add column if not exists brand_guidelines text default '';

create index if not exists properties_client_idx on public.properties(client_id);

-- 2. Competitors Tracking Table
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  url text not null,
  brand text default '',
  city text not null,
  state char(2) not null,
  distance_miles numeric,
  star_rating numeric,
  primary_keywords text[] default '{}',
  domain_authority integer,
  created_at timestamptz not null default now(),
  unique (property_id, url)
);

create index if not exists competitors_property_idx on public.competitors(property_id);
alter table public.competitors enable row level security;

-- 3. Backlinks & Outreach Targets Table
create table if not exists public.backlinks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  target_url text not null,
  source_url text not null,
  source_domain text not null,
  anchor_text text default '',
  is_follow boolean not null default true,
  category text default 'general',
  opportunity_type text default 'unlinked_mention' check (opportunity_type in ('unlinked_mention', 'local_citation', 'press_feature', 'directory', 'partner')),
  outreach_status text not null default 'prospect' check (outreach_status in ('prospect', 'contacted', 'acquired', 'declined')),
  last_contacted_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now(),
  unique (property_id, source_url)
);

create index if not exists backlinks_property_idx on public.backlinks(property_id, outreach_status);
alter table public.backlinks enable row level security;

-- 4. GEO & AI Search Observations Table
create table if not exists public.geo_observations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  platform text not null check (platform in ('chatgpt_search', 'google_ai_overviews', 'perplexity', 'copilot', 'gemini')),
  prompt_text text not null,
  query_category text not null,
  is_brand_mentioned boolean not null default false,
  is_cited boolean not null default false,
  citation_url text,
  competitors_mentioned text[] default '{}',
  sentiment text default 'neutral' check (sentiment in ('positive', 'neutral', 'negative')),
  evidence_snippet text,
  observed_at timestamptz not null default now()
);

create index if not exists geo_observations_property_idx on public.geo_observations(property_id, platform, observed_at desc);
alter table public.geo_observations enable row level security;

-- 5. SEO Operational Project Tasks Table
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  title text not null,
  description text default '',
  category text not null check (category in ('On Page', 'Technical', 'Off Page', 'Local', 'Content', 'Reporting')),
  priority text not null default 'Medium' check (priority in ('Critical', 'High', 'Medium', 'Low')),
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Under Review', 'Approved', 'Completed', 'Blocked')),
  assignee text default '',
  target_url text default '',
  target_keyword text default '',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_property_status_idx on public.project_tasks(property_id, status);
alter table public.project_tasks enable row level security;
