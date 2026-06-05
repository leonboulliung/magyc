-- ============================================================
-- 018 — Schema reset for the "Creator" rebuild.
--
-- The idea/thing duality goes away. A card is a card. Whether it feels
-- like an idea or a project to you depends on whether YOU joined it.
-- Per-viewer state, not global state.
--
-- This migration is destructive: existing cards / joiners / signals
-- are wiped. We are in pre-launch development and the user has
-- explicitly approved the wipe.
--
-- Changes:
--  1. Drop the `signals` table entirely (no more idea-resonance).
--  2. Drop `cards.kind`, `cards.archived`, `cards.duration_days`,
--     `cards.forked_from_*` — all artifacts of the idea/thing model.
--  3. Rename `cards.expires_at` → `cards.starts_at` so the column
--     name finally matches its meaning.
--  4. Drop `joiners` + `join_requests` tables; create new `members`
--     table with a `state` column ('joined' | 'requested'). One row
--     per (card, user) regardless of whether they're confirmed.
--  5. RLS policies re-issued for the new table.
-- ============================================================

-- 1) Wipe data first (so the structural changes don't trip on rows).
truncate table cards          cascade;
truncate table joiners        cascade;
truncate table join_requests  cascade;
truncate table signals        cascade;

-- 2) Drop signals entirely (the resonance / idea-side concept is gone).
drop table if exists signals cascade;

-- 3) Clean cards columns.
alter table cards drop column if exists kind;
alter table cards drop column if exists archived;
alter table cards drop column if exists duration_days;
alter table cards drop column if exists forked_from_card_id;
alter table cards drop column if exists forked_from_owner_id;
alter table cards drop column if exists forked_from_title;

-- Rename expires_at → starts_at (the column has been the start time
-- since the 007/008 refit; the name was vestigial).
alter table cards rename column expires_at to starts_at;

-- starts_at is now optional — a card can be a pure idea without a date.
alter table cards alter column starts_at drop not null;

-- spots is also now optional (an idea without a cap is fine).
alter table cards alter column spots drop not null;

-- 4) Members table replaces joiners + join_requests.
drop table if exists joiners        cascade;
drop table if exists join_requests  cascade;

create table members (
  card_id      text not null references cards(id) on delete cascade,
  user_id      text not null references profiles(id) on delete cascade,
  -- 'joined' = confirmed, 'requested' = pending owner accept.
  state        text not null default 'joined'
               check (state in ('joined', 'requested')),
  -- Optional role label the member claimed ("Foto", "Tonkundige", …).
  role         text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index members_user_idx       on members(user_id);
create index members_card_state_idx on members(card_id, state);

-- 5) RLS — public read of members (so anyone can see the crew), writes
--    only through the service_role (API routes do the auth).
alter table members enable row level security;

drop policy if exists "members_select_all" on members;
create policy "members_select_all" on members
  for select using (true);
