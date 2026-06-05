-- ============================================================
-- 012 — Trust & Safety: bans, reports, blocks
-- ============================================================
-- Three lightweight pieces for the moment real meetups start happening:
--
--   • `profiles.banned` — admin-set flag. Banned profiles are hidden from
--     the feed and cannot post / join / signal (enforced in the API
--     routes). Their existing cards remain in the DB but are filtered out
--     of public surfaces.
--
--   • `reports` — a signed-in user flags a card or a profile with a
--     reason. Reports are NOT publicly readable; the admin queue is the
--     only consumer.
--
--   • `blocks` — one user blocks another. Their cards drop out of the
--     blocker's feed. Symmetric blocking would be heavier; we keep this
--     one-directional and let the admin queue handle the rest.
-- ============================================================

-- 1) Banned flag on profiles.
alter table profiles
  add column if not exists banned boolean not null default false;

-- 2) Reports.
create table if not exists reports (
  id                 text primary key,
  reporter_id        text not null references profiles(id) on delete cascade,
  target_kind        text not null check (target_kind in ('card', 'profile')),
  target_card_id     text references cards(id) on delete cascade,
  target_profile_id  text references profiles(id) on delete cascade,
  reason             text not null,
  detail             text,
  resolved           boolean not null default false,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- Exactly one target column is populated, matching target_kind.
  check (
    (target_kind = 'card'    and target_card_id    is not null and target_profile_id is null)
 or (target_kind = 'profile' and target_profile_id is not null and target_card_id    is null)
  )
);

create index if not exists reports_unresolved_idx
  on reports(resolved, created_at desc) where not resolved;
create index if not exists reports_target_card_idx
  on reports(target_card_id) where target_card_id is not null;
create index if not exists reports_target_profile_idx
  on reports(target_profile_id) where target_profile_id is not null;

-- 3) Blocks.
create table if not exists blocks (
  blocker_id text not null references profiles(id) on delete cascade,
  blocked_id text not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocker_idx on blocks(blocker_id);
create index if not exists blocks_blocked_idx on blocks(blocked_id);

-- 4) RLS — reports and blocks are private; the API routes are the only
-- channels. profiles.banned reads through the existing profiles RLS.
alter table reports enable row level security;
alter table blocks  enable row level security;
-- No SELECT/INSERT/UPDATE policies → service_role only.
