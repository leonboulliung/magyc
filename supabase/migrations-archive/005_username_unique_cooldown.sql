-- Username rules:
--   1) Each display_name must be unique (case-insensitive).
--   2) A user may change their display_name at most once per 7 days.
--
-- This migration:
--   • Resolves any existing duplicates by appending the last 4 chars of the id
--     (deterministic, idempotent — re-running won't double-suffix).
--   • Adds a unique partial index on lower(display_name).
--   • Adds username_changed_at, which the API sets whenever display_name changes.

-- 1) Disambiguate duplicates (if any). We only touch rows that have a sibling
--    sharing the same lower-cased name. Append "-XXXX" where XXXX = last 4 of id.
update profiles p
set display_name = display_name || '-' || right(id, 4)
where exists (
  select 1
  from profiles q
  where q.id <> p.id
    and lower(q.display_name) = lower(p.display_name)
)
-- Guard against double-suffixing on re-run.
and p.display_name !~ '-[a-z0-9]{4}$';

-- 2) Case-insensitive uniqueness.
create unique index if not exists profiles_display_name_unique
  on profiles (lower(display_name));

-- 3) Last-changed timestamp (nullable; existing rows count as "never changed
--    after this migration", so first edit is always allowed).
alter table profiles add column if not exists username_changed_at timestamptz;
