-- UI strings cache.
--
-- Stores AI-generated label bundles indexed by language tag (e.g. "de", "fr", "ja").
-- Generated once per locale on first request via the compose API route, then served
-- from this table on every subsequent request without hitting the AI.
-- Clearing a row forces regeneration on the next request.

create table if not exists ui_strings_cache (
  locale        text         primary key,
  strings       jsonb        not null,
  generated_at  timestamptz  not null default now()
);

-- Service role bypasses RLS by default. Anon/authenticated have no access;
-- strings are fetched server-side only via the admin client.
alter table ui_strings_cache enable row level security;
