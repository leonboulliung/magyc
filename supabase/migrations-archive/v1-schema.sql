-- ============================================================
-- MAGYC — Supabase schema
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Profiles: synced from Clerk via webhook (or on first action)
create table if not exists profiles (
  id           text primary key,              -- Clerk user ID (e.g. "user_2abc...")
  phone        text unique,                   -- E.164 from Clerk
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Cards: one active per user, then archived to track record
create table if not exists cards (
  id            text primary key,
  owner_id      text not null references profiles(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  location      jsonb not null,                                       -- { lat, lng, label }
  spots         int  not null check (spots >= 1 and spots <= 99),
  permission    text not null check (permission in ('public', 'request')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  duration_days int  not null check (duration_days in (1, 3, 7)),
  archived      boolean not null default false
);

create index if not exists cards_owner_idx   on cards(owner_id);
create index if not exists cards_active_idx  on cards(archived, expires_at) where archived = false;
create index if not exists cards_created_idx on cards(created_at desc);

-- Joiners: who joined + owner-assigned role + when
create table if not exists joiners (
  card_id   text not null references cards(id) on delete cascade,
  user_id   text not null references profiles(id) on delete cascade,
  role      text not null default '',
  joined_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists joiners_user_idx on joiners(user_id);

-- Join requests: pending invites for request-mode cards
create table if not exists join_requests (
  card_id      text not null references cards(id) on delete cascade,
  user_id      text not null references profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists join_requests_user_idx on join_requests(user_id);

-- ============================================================
-- RLS: everything readable, writes only via service_role (API routes)
-- ============================================================
alter table profiles      enable row level security;
alter table cards         enable row level security;
alter table joiners       enable row level security;
alter table join_requests enable row level security;

-- Public read for all four tables (the city layer is public by design)
drop policy if exists "profiles_select_all"      on profiles;
drop policy if exists "cards_select_all"         on cards;
drop policy if exists "joiners_select_all"       on joiners;
drop policy if exists "join_requests_select_all" on join_requests;

create policy "profiles_select_all"      on profiles      for select using (true);
create policy "cards_select_all"         on cards         for select using (true);
create policy "joiners_select_all"       on joiners       for select using (true);
create policy "join_requests_select_all" on join_requests for select using (true);

-- No INSERT/UPDATE/DELETE policies = service_role only.

-- ============================================================
-- Realtime: stream changes to subscribed clients
-- ============================================================
alter publication supabase_realtime add table cards;
alter publication supabase_realtime add table joiners;
alter publication supabase_realtime add table join_requests;

-- ============================================================
-- Helpers
-- ============================================================

-- Touch updated_at on profile changes
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
before update on profiles
for each row
execute function set_updated_at();

-- Auto-archive expired cards. Either call manually or schedule via Supabase Cron:
--   select cron.schedule('archive-expired', '*/5 * * * *', $$ select archive_expired_cards(); $$);
create or replace function archive_expired_cards()
returns void
language sql
as $$
  update cards set archived = true where archived = false and expires_at <= now();
$$;
