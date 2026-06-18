-- ============================================================
-- 013 — Project retention + preset options
--
-- Projects can now be archived or soft-deleted. Deleted projects stay
-- queryable for a 30-day recovery window in the Studio UI instead of
-- being removed immediately.
--
-- The preset option is repeated here because 012 may already exist in
-- deployed databases from an earlier iteration.
-- ============================================================

alter table studio_presets
  add column if not exists allow_context_modules boolean not null default true;

alter table spaces
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists spaces_owner_active_created_idx
  on spaces(owner_id, deleted_at, archived_at, created_at desc);

create index if not exists spaces_owner_deleted_idx
  on spaces(owner_id, deleted_at desc)
  where deleted_at is not null;
