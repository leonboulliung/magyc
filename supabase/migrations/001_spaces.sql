-- ============================================================
-- v3 — Spaces
--
-- A "space" is the collaborative workspace that emerges from a single
-- piece of text input. The AI classifies the input, picks 3–7 modules
-- from a fixed registry (15 types), configures each, and stores the
-- result here. Visitors arrive via the URL; the creator publishes when
-- they're ready, which is the first moment auth is required.
--
-- Three identity tiers:
--   1. Anonymous browser token   — local UUID, the creator carries it.
--                                  Without it, edit access to one's own
--                                  space is lost (acceptable for drafts).
--   2. Anonymous contributor     — visitor with their own browser token
--                                  who interacts with modules.
--   3. Clerk-authenticated owner — only required at publish-time; the
--                                  anon_owner_token then binds to user.
--
-- Everything except `owner_id`, `visibility`, `password_hash`, and
-- `published_at` is filled at creation; those four land at publish.
-- ============================================================

-- Profiles — minimal Clerk bridge. Idempotent.
create table if not exists profiles (
  id           text primary key,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Spaces.
create table if not exists spaces (
  id                text primary key,                            -- short slug (10 chars)
  input_text        text not null,                               -- original seed
  title             text not null default '',                    -- AI-generated headline
  language          text not null default 'en',                  -- detected language code
  vibe              text not null default 'minimal',             -- editorial|document|dashboard|terminal|soft|minimal
  modules           jsonb not null default '[]'::jsonb,          -- typed module configs

  -- Anonymous owner identifier. Set at creation, stored in the
  -- creator's browser localStorage. Until publish, this is the only
  -- way to edit a space.
  anon_owner_token  text not null,

  -- Set when the creator publishes — binds the anon token to a
  -- Clerk user. From that point on, ownership is by user_id.
  owner_id          text references profiles(id) on delete set null,

  -- Visibility — null while unpublished (draft, only the anon owner
  -- via local token can edit). At publish: 'public' or 'password'.
  visibility        text check (visibility in ('public', 'password') or visibility is null),
  password_hash     text,                                        -- bcrypt; only when visibility='password'

  created_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index if not exists spaces_owner_idx on spaces(owner_id);
create index if not exists spaces_published_idx on spaces(published_at);

-- module_state — per-module collaborative state. Poll votes, checklist
-- ticks, help-slot claims, voices, freely-edited notes. Each row is a
-- single action by an actor; the UI aggregates for display.
--
-- actor_kind: 'anon' means the actor is a browser token (visitor); the
-- display_name snapshot is whatever they typed at write time. 'user'
-- means a signed-in Clerk user; we still snapshot the display_name so
-- a renamed account doesn't retroactively alter old contributions.
create table if not exists module_state (
  id            text primary key,
  space_id      text not null references spaces(id) on delete cascade,
  module_index  int  not null,

  actor_kind    text not null check (actor_kind in ('user', 'anon')),
  actor_id      text not null,
  display_name  text,

  -- Discriminator for what kind of action this is. The shape of `data`
  -- depends on the kind and is validated app-side.
  kind          text not null check (kind in ('vote', 'check', 'claim', 'voice', 'edit', 'add')),
  data          jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

create index if not exists module_state_space_idx  on module_state(space_id);
create index if not exists module_state_module_idx on module_state(space_id, module_index);
create index if not exists module_state_actor_idx  on module_state(actor_kind, actor_id);

-- RLS — public read; writes only through service_role (API routes).
alter table profiles     enable row level security;
alter table spaces       enable row level security;
alter table module_state enable row level security;

drop policy if exists "profiles_select_all"     on profiles;
drop policy if exists "spaces_select_all"       on spaces;
drop policy if exists "module_state_select_all" on module_state;

create policy "profiles_select_all"     on profiles     for select using (true);
create policy "spaces_select_all"       on spaces       for select using (true);
create policy "module_state_select_all" on module_state for select using (true);
