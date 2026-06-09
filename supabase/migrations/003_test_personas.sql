-- ============================================================
-- 003 — Test personas
--
-- Two stable profile rows so the persona switcher in the UI has
-- something to attribute collaborative state (votes, ticks, voices,
-- discussion messages) to. Both rows survive resets; the migration
-- is idempotent.
--
-- Anon tokens are intentionally short + readable here — these accounts
-- exist only for testing and are NOT meant to represent real Clerk
-- users. Production users go through Clerk → ensureProfile.
-- ============================================================

insert into profiles (id, display_name, avatar_url)
values
  ('persona-alice-0001', 'Alice',  null),
  ('persona-bob-0002',   'Bob',    null)
on conflict (id) do update
  set display_name = excluded.display_name;
