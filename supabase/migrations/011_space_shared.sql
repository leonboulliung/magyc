-- ============================================================
-- 011 — Project sharing (Creator Suite, Phase D)
--
-- Suite projects are private to their owner until explicitly shared.
-- `shared=true` opens the unlisted /s/[id] link for anyone who has it
-- (view + collaborative contribution; structural edits stay owner-only).
--
-- Only affects suite projects (stage != null). Anonymous spaces
-- (stage null) and published spaces are unaffected — they ignore this
-- flag. Existing rows backfill to false (private) via the default.
-- ============================================================

alter table spaces add column if not exists shared boolean not null default false;
