-- Roadmap: an ordered list of short labels for a thing — the abstract
-- shape of the steps the creator needs to make it happen. Like custom
-- fields, the AI proposes labels by abstracting what the creator already
-- wrote; the creator owns the order, the wording, and (later) the state.
--
-- Stored as a JSONB array of strings so we don't have to migrate per-row
-- and so the order the client sets is preserved.

alter table cards
  add column if not exists roadmap jsonb not null default '[]'::jsonb;

update cards set roadmap = '[]'::jsonb where roadmap is null;
