-- ============================================================
-- 006 — v4 finalization
--
-- Catches up the database schema with the v4 code that may not have
-- been applied yet. Every statement is idempotent so it is safe to
-- run even if some steps already exist.
--
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

-- 1) Ensure `labels` column exists on spaces.
--    Migration 005 added this; this is a safety net in case it wasn't run.
alter table spaces
  add column if not exists labels jsonb not null default '{}'::jsonb;

-- 2) Update the module_state.kind CHECK constraint to include the
--    new action kinds introduced in v4 (upload = file attachment,
--    stroke = sketch canvas stroke). PostgreSQL requires dropping and
--    re-adding inline constraints by their auto-generated name.
--
--    The constraint name is deterministic: table_column_check.
alter table module_state
  drop constraint if exists module_state_kind_check;

alter table module_state
  add constraint module_state_kind_check
  check (kind in ('vote', 'check', 'claim', 'voice', 'edit', 'add', 'upload', 'stroke'));

-- 3) Ensure the space_assets storage bucket exists.
--    This was created in migration 004; re-applying is safe (ON CONFLICT).
insert into storage.buckets (id, name, public)
values ('space_assets', 'space_assets', true)
on conflict (id) do update
  set public = excluded.public;

-- 4) Storage RLS policies (idempotent).
drop policy if exists "space_assets_read"  on storage.objects;
create policy "space_assets_read" on storage.objects
  for select using (bucket_id = 'space_assets');

-- 5) Ensure test persona colors are set.
--    Migration 003 inserted the personas; 004 added the color column.
--    This sets deterministic accent colors in case they're still null.
update profiles
  set color = '#7da3c0'
  where id = 'persona-alice-0001' and color is null;

update profiles
  set color = '#d4a373'
  where id = 'persona-bob-0002' and color is null;

-- 6) Backfill existing profiles that still have no color.
update profiles
  set color = case
    when substring(md5(id), 1, 1) in ('0','1','2') then '#7da3c0'
    when substring(md5(id), 1, 1) in ('3','4','5') then '#d4a373'
    when substring(md5(id), 1, 1) in ('6','7','8') then '#a3c08e'
    when substring(md5(id), 1, 1) in ('9','a','b') then '#c0857d'
    when substring(md5(id), 1, 1) in ('c','d')     then '#8d8dc0'
    else '#c0bd7d'
  end
  where color is null;
