-- Idea forks: any signed-in user can transform someone else's idea into
-- their own thing — without the idea-owner's approval. The new thing
-- carries an immutable credit to the originating idea ("abstammt aus
-- @owner — title"). The original idea stays untouched and can be forked
-- again by anyone else.
--
-- Owner-own transform stays as today (in-place flip; idea row becomes a
-- thing row). It's only the cross-user case that creates a new card and
-- writes these credit columns.
--
-- The credit is stored as a snapshot of owner id + title at fork time,
-- so it survives deletion of the original idea. The foreign keys are
-- `on delete set null` so a deleted origin degrades gracefully to
-- "abstammt aus (gelöschter) idee" instead of cascading the thing away.

alter table cards
  add column if not exists forked_from_card_id   text references cards(id)    on delete set null,
  add column if not exists forked_from_owner_id  text references profiles(id) on delete set null,
  add column if not exists forked_from_title     text;

create index if not exists cards_forked_from_idx
  on cards(forked_from_card_id)
  where forked_from_card_id is not null;
