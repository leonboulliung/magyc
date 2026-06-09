-- ============================================================
-- 005 — Space labels
--
-- The application has NO own visible system language. Every word the
-- user sees on a published space (privacy toggle, publish button,
-- version banner, empty-state hints, …) is AI-generated in the
-- user's language during classification and stored alongside the
-- modules.
--
-- `labels` is a jsonb object of optional strings. Components read it
-- with sensible Unicode-symbol fallbacks so a partial labels object
-- never leaves the UI broken.
-- ============================================================

alter table spaces
  add column if not exists labels jsonb not null default '{}'::jsonb;
