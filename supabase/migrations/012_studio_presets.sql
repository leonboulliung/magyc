-- ============================================================
-- 012 — Studio presets
--
-- Account-bound workflow presets for photographers. A preset defines
-- which configurable modules a new project should start with and which
-- prompt rules should be injected during project creation.
--
-- Writes go through service_role API routes. Users can read only their
-- own presets via API; no direct browser writes.
-- ============================================================

create table if not exists studio_presets (
  id                 text primary key,
  owner_id           text not null references profiles(id) on delete cascade,
  name               text not null default '',
  description        text not null default '',
  modules            jsonb not null default '[]'::jsonb,
  prompt_injections  jsonb not null default '[]'::jsonb,
  allow_context_modules boolean not null default true,
  position           int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists studio_presets_owner_position_idx
  on studio_presets(owner_id, position asc);

alter table studio_presets enable row level security;

drop policy if exists "studio_presets_select_owner" on studio_presets;

create policy "studio_presets_select_owner"
  on studio_presets
  for select
  using (auth.uid()::text = owner_id);
