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

-- ---------------------------------------------------------------------------
-- Community food database: everyone can read, signed-in users can contribute.
-- (Added later — safe to run this whole file again; statements are idempotent.)
create table if not exists public.community_foods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  serving    text not null check (char_length(serving) between 1 and 60),
  calories   numeric not null check (calories >= 0 and calories <= 5000),
  protein    numeric not null check (protein >= 0 and protein <= 500),
  carbs      numeric not null check (carbs >= 0 and carbs <= 1000),
  fat        numeric not null check (fat >= 0 and fat <= 500),
  barcode    text check (barcode ~ '^[0-9]{8,14}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.community_foods enable row level security;

drop policy if exists "anyone reads foods" on public.community_foods;
create policy "anyone reads foods"
  on public.community_foods for select
  using (true);

drop policy if exists "signed-in users add foods" on public.community_foods;
create policy "signed-in users add foods"
  on public.community_foods for insert
  with check (auth.uid() = created_by);

drop policy if exists "authors fix their own foods" on public.community_foods;
create policy "authors fix their own foods"
  on public.community_foods for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "authors remove their own foods" on public.community_foods;
create policy "authors remove their own foods"
  on public.community_foods for delete
  using (auth.uid() = created_by);
