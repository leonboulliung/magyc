-- ============================================================
-- 010 — Project lifecycle (Creator Suite, Phase A)
--
-- The Creator Suite turns a space into an account-first "project" that
-- moves through stages. Two nullable columns carry that; existing
-- anonymous spaces keep both null and behave exactly as before.
--
--   stage    'brief' | 'production' | 'handoff'   (lifecycle position)
--   segment  'product' | 'event' | 'wedding' | …  (which guided preset)
--
-- owner_id already exists (001); suite projects set it AT CREATION
-- (anonymous spaces still set it only at publish). No data backfill.
-- ============================================================

alter table spaces add column if not exists stage   text;
alter table spaces add column if not exists segment text;

-- Dashboard lists a user's projects newest-first; this supports the
-- owner_id filter + ordering.
create index if not exists spaces_owner_created_idx on spaces(owner_id, created_at desc);
