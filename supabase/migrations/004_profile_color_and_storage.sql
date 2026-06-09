-- ============================================================
-- 004 — Profile color + Storage bucket
--
-- Two foundation pieces that several v4 widgets need:
--
--   (a) Profiles get a `color` column. Sketch strokes and Checklist
--       attribution dots take their hue from here. Existing rows
--       get a default that we'll re-assign per-user later.
--
--   (b) A `space_assets` Storage bucket for Anhänge / Bild-Ablage /
--       Audio-Ablage. Public-read (so attachments embed cleanly in
--       a shared space), writes only via service_role.
-- ============================================================

-- 1) Profile color
alter table profiles
  add column if not exists color text;

-- Assign each existing profile a deterministic-but-varied color so
-- the UI never has to deal with null in the meantime. The colors come
-- from a curated palette; widget renderers may still re-derive.
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

-- 2) Storage bucket — public-read so attachment URLs work for any
--    visitor with the space link. Writes are still gated by the API
--    routes which use the service_role key.
insert into storage.buckets (id, name, public)
values ('space_assets', 'space_assets', true)
on conflict (id) do update
  set public = excluded.public;

-- Storage RLS — anyone can read; nobody can write through the anon
-- key (writes will go through service_role from our API).
drop policy if exists "space_assets_read"  on storage.objects;
drop policy if exists "space_assets_write" on storage.objects;

create policy "space_assets_read" on storage.objects
  for select using (bucket_id = 'space_assets');
