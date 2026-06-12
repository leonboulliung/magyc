-- Custom fields: a card-specific key/value sidebar of details that suit
-- the particular kind of thing — a shoot's "looks", a hackathon's "stack",
-- a dinner's "bring". The keys are AI-suggested (strictly abstracted from
-- the owner's own intent, never invented), the values come from the
-- owner. Stored as a JSONB object so we don't have to migrate per-field
-- and so order is preserved by the client.
--
-- Read by anyone (just a public detail). Writes only via the API routes
-- using the service role.

alter table cards
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- Make sure existing rows are normalized to the empty-object shape, so
-- the app can read .customFields without null-guards everywhere.
update cards set custom_fields = '{}'::jsonb where custom_fields is null;
