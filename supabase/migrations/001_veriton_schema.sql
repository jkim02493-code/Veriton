create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  lifetime_searches integer not null default 0,
  searches_today integer not null default 0,
  last_reset_date date,
  stripe_customer_id text,
  created_at timestamp with time zone not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "users_delete_own" on public.users;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users_delete_own"
  on public.users for delete
  using (auth.uid() = id);

create table if not exists public.starred_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_title text not null,
  authors text,
  url text,
  citation_apa text,
  citation_mla text,
  year text,
  starred_at timestamp with time zone not null default now()
);

alter table public.starred_sources enable row level security;

drop policy if exists "starred_sources_select_own" on public.starred_sources;
drop policy if exists "starred_sources_insert_own" on public.starred_sources;
drop policy if exists "starred_sources_update_own" on public.starred_sources;
drop policy if exists "starred_sources_delete_own" on public.starred_sources;

create policy "starred_sources_select_own"
  on public.starred_sources for select
  using (auth.uid() = user_id);

create policy "starred_sources_insert_own"
  on public.starred_sources for insert
  with check (auth.uid() = user_id);

create policy "starred_sources_update_own"
  on public.starred_sources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "starred_sources_delete_own"
  on public.starred_sources for delete
  using (auth.uid() = user_id);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  query text not null,
  sources_returned jsonb not null default '[]'::jsonb,
  searched_at timestamp with time zone not null default now()
);

alter table public.search_history enable row level security;

drop policy if exists "search_history_select_own" on public.search_history;
drop policy if exists "search_history_insert_own" on public.search_history;
drop policy if exists "search_history_update_own" on public.search_history;
drop policy if exists "search_history_delete_own" on public.search_history;

create policy "search_history_select_own"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "search_history_insert_own"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "search_history_update_own"
  on public.search_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "search_history_delete_own"
  on public.search_history for delete
  using (auth.uid() = user_id);

create table if not exists public.seen_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_url text not null,
  seen_at timestamp with time zone not null default now(),
  unique (user_id, source_url)
);

alter table public.seen_sources enable row level security;

drop policy if exists "seen_sources_select_own" on public.seen_sources;
drop policy if exists "seen_sources_insert_own" on public.seen_sources;
drop policy if exists "seen_sources_update_own" on public.seen_sources;
drop policy if exists "seen_sources_delete_own" on public.seen_sources;

create policy "seen_sources_select_own"
  on public.seen_sources for select
  using (auth.uid() = user_id);

create policy "seen_sources_insert_own"
  on public.seen_sources for insert
  with check (auth.uid() = user_id);

create policy "seen_sources_update_own"
  on public.seen_sources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "seen_sources_delete_own"
  on public.seen_sources for delete
  using (auth.uid() = user_id);

