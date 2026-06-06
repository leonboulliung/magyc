-- ============================================================
-- v2 — Spaces
--
-- A "space" is the workspace that emerges from a single piece of input.
-- The owner writes a thought / idea / question / concern / plan, the
-- composer assembles a set of primitives, and the space gets a short
-- URL that the owner shares through their existing channels.
--
-- A "contribution" is anything a visitor adds to a space — a response,
-- a claim on a help-needed slot, a resource link.
--
-- Profiles bridge to Clerk users. If the v1 profiles table is still
-- present in the live project, this migration leaves it alone (the
-- create-if-not-exists is a no-op).
-- ============================================================

-- Profiles — minimal Clerk bridge. v1 columns stay if the table exists.
create table if not exists profiles (
  id           text primary key,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Spaces.
create table if not exists spaces (
  id          text primary key,                                                -- short URL slug
  owner_id    text not null references profiles(id) on delete cascade,
  input_text  text not null,                                                   -- the seed
  title       text not null default '',                                        -- AI-generated headline
  language    text not null default 'en',                                      -- detected language code
  primitives  jsonb not null default '[]'::jsonb,                              -- ordered, typed
  created_at  timestamptz not null default now()
);

create index if not exists spaces_owner_idx on spaces(owner_id);

-- Contributions: what visitors add.
create table if not exists contributions (
  id              text primary key,
  space_id        text not null references spaces(id) on delete cascade,
  primitive_index int  not null,
  user_id         text not null references profiles(id) on delete cascade,
  kind            text not null,                                               -- 'voice' | 'claim' | 'resource' | ...
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists contributions_space_idx on contributions(space_id);
create index if not exists contributions_user_idx  on contributions(user_id);

-- RLS — public read of everything; writes happen through the API routes
-- which use the service_role key.
alter table profiles      enable row level security;
alter table spaces        enable row level security;
alter table contributions enable row level security;

drop policy if exists "profiles_select_all"      on profiles;
drop policy if exists "spaces_select_all"        on spaces;
drop policy if exists "contributions_select_all" on contributions;

create policy "profiles_select_all"      on profiles      for select using (true);
create policy "spaces_select_all"        on spaces        for select using (true);
create policy "contributions_select_all" on contributions for select using (true);
