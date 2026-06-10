-- ============================================================
-- 008 — Realtime for collaborative state
--
-- Enables Supabase Realtime on module_state so every open SpaceView
-- receives INSERT/DELETE events live instead of re-fetching the whole
-- space graph after each action.
--
--   (a) add the table to the realtime publication (idempotent);
--   (b) REPLICA IDENTITY FULL so DELETE events carry the full old row —
--       required for the space_id filter to apply to deletes (vote /
--       check / claim toggles delete prior rows server-side).
--
-- Run in the Supabase SQL editor.
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table module_state;
exception
  when duplicate_object then null;
end $$;

alter table module_state replica identity full;
