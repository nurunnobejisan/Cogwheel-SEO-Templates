-- Custom AI training rules & team feedback injected into Claude system prompts
create table if not exists public.ai_training_rules (
  id uuid primary key default gen_random_uuid(),
  task_id text,
  title text not null,
  rule_text text not null,
  example_bad text,
  example_good text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_training_rules_task_idx
  on public.ai_training_rules(task_id, active, created_at desc);

alter table public.ai_training_rules enable row level security;

