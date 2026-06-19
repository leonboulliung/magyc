-- 014 — Studio profile + settings fields.
--
-- Extends the minimal `profiles` table so the Studio Profil and Einstellungen
-- pages have somewhere to persist account-level data:
--   headline / bio / specialties — the photographer's public-facing profile.
--   settings                     — account preferences + global working rules.
--
-- All idempotent. Apply manually in the Supabase SQL editor before deploying
-- the matching app changes.

alter table profiles
  add column if not exists headline    text,
  add column if not exists bio         text,
  add column if not exists specialties jsonb not null default '[]'::jsonb,
  add column if not exists settings    jsonb not null default '{}'::jsonb;
