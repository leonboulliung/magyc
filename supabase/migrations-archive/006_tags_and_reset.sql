-- v2: Tags replace categories. Free-form short strings instead of a 9-value enum.
-- Profile interests stay text[] but their semantics shift from whitelist to free.
-- Existing cards are dropped — the schema changes too significantly to migrate
-- in place and we agreed on a clean slate.

-- 1) Drop existing cards/joiners/requests — profiles stay.
truncate table cards          cascade;
truncate table joiners        cascade;
truncate table join_requests  cascade;

-- 2) Replace category with tags.
alter table cards drop column if exists category;
alter table cards add  column if not exists tags text[] not null default '{}';

-- 3) Optional: a GIN index helps if we later add tag-based filtering.
create index if not exists cards_tags_idx on cards using gin (tags);

-- 4) Interests stay text[] but we no longer constrain to the old 9-value set.
--    Existing values (e.g. 'film') are valid free-form tags, so no data move.
