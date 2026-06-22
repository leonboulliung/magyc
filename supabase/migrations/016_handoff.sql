-- 016 — Abschluss (handoff) info.
--
-- The closing surface of a project: once a project is in the Abschluss stage,
-- the photographer can attach a short note + links/references (final gallery,
-- invoice, drive folder, …) that the client sees via the shared link. Stored
-- on the space so it always exists and is readable on the public /s/[id] path.
--   handoff = { note: string, links: [{ label, url }] }
alter table spaces add column if not exists handoff jsonb not null default '{}'::jsonb;
