-- ============================================================
-- 002 — Versions
--
-- Before a space is published it is a working draft — the anon owner
-- iterates with the AI, no version history. The publish action is the
-- threshold: at that moment the current modules are snapshotted as
-- version 1, and every subsequent saved change creates v2, v3, …
--
-- The version bar in the UI is the affordance for browsing this
-- history. Reactive collaboration state (votes, ticks, claims, voices)
-- continues to live in module_state and is NOT versioned — it is the
-- live conversation atop whatever the current snapshot says.
-- ============================================================

create table if not exists space_versions (
  id          text primary key,
  space_id    text not null references spaces(id) on delete cascade,
  version     int  not null,                          -- 1, 2, 3, …
  modules     jsonb not null,                         -- snapshot
  title       text not null default '',               -- snapshot of space title
  note        text,                                   -- optional change note
  created_at  timestamptz not null default now(),
  unique (space_id, version)
);

create index if not exists space_versions_space_idx
  on space_versions(space_id);

-- RLS — public read; writes happen via service_role.
alter table space_versions enable row level security;

drop policy if exists "space_versions_select_all" on space_versions;
create policy "space_versions_select_all" on space_versions
  for select using (true);
