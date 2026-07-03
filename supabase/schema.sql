-- Health Hub backend schema
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

-- One row per user holding their full app state as JSON.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only ever touch their own row.
alter table public.app_state enable row level security;

drop policy if exists "read own state" on public.app_state;
create policy "read own state"
  on public.app_state for select
  using (auth.uid() = user_id);

drop policy if exists "insert own state" on public.app_state;
create policy "insert own state"
  on public.app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own state" on public.app_state;
create policy "update own state"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own state" on public.app_state;
create policy "delete own state"
  on public.app_state for delete
  using (auth.uid() = user_id);
