-- ============================================================
-- 008 — Ideas, Things, and resonance Signals
-- ============================================================
-- The emergent-design model: two object kinds on `cards` + one bridge.
--
--   • kind = 'thing'  — concrete, joinable (≈ today's card). DEFAULT.
--   • kind = 'idea'   — a thought thrown into the field. Cheap, low-commitment.
--                       Just text + an optional loose location. People give a
--                       one-tap resonance Signal ("I'd want this to exist /
--                       I'd help make it real") instead of joining.
--
--   • Transformation idea → thing is a deliberate human act (an API route),
--     not a phase the user declares. Signalers are carried over as the warm
--     first crew (invited via join_requests).
--
-- Stages are BEHAVIORAL. No phase state machine — we reuse `archived`
-- ("open until it happens") exactly as before.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================

-- 1) kind discriminator. Default 'thing' so every existing card keeps working.
alter table cards add column if not exists kind text not null default 'thing'
  check (kind in ('idea', 'thing'));

-- 2) An idea is cheap: everything except the text is optional. Relax the
--    NOT NULL constraints that only ever made sense for a concrete Thing.
--    Things still get these validated in the API route, not the DB.
alter table cards alter column location   drop not null;
alter table cards alter column spots      drop not null;
alter table cards alter column permission drop not null;
alter table cards alter column expires_at drop not null;

-- duration_days had check (1,3,7). Ideas don't carry one — allow null and
-- widen the check so the vestigial value the API sends (1) still passes.
alter table cards alter column duration_days drop not null;
alter table cards drop constraint if exists cards_duration_days_check;

-- spots check stays meaningful only when present.
alter table cards drop constraint if exists cards_spots_check;
alter table cards add  constraint cards_spots_check
  check (spots is null or (spots >= 1 and spots <= 99));

-- A helpful index for "all live ideas" / "all live things" field queries.
create index if not exists cards_kind_active_idx
  on cards (kind, archived, created_at desc) where archived = false;

-- 3) Signals — resonance on an idea. Lighter than a joiner: no role, no
--    accept/decline. It is INTENT, not a vanity like. One per (card,user).
create table if not exists signals (
  card_id    text not null references cards(id) on delete cascade,
  user_id    text not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists signals_card_idx on signals(card_id);
create index if not exists signals_user_idx on signals(user_id);

-- 4) RLS — public read, writes only via service_role (matches the others).
alter table signals enable row level security;
drop policy if exists "signals_select_all" on signals;
create policy "signals_select_all" on signals for select using (true);
-- No INSERT/UPDATE/DELETE policies = service_role only.

-- 5) Realtime — stream signal changes so the field feels alive.
--    Wrapped so a re-run doesn't error if the table is already in the publication.
do $$
begin
  alter publication supabase_realtime add table signals;
exception
  when duplicate_object then null;
end $$;
