-- v2.1 schema additions:
--   • cards.ends_at         — when does the thing end (nullable = open-ended)
--   • cards.external_url    — optional "more info" link (GitHub, Strava, Are.na…)
--   • profiles.bio          — one or two lines about the creator (≤200 chars)

alter table cards    add column if not exists ends_at      timestamptz;
alter table cards    add column if not exists external_url text;
alter table profiles add column if not exists bio          text;
