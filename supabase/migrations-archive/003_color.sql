-- Explicit color picked by the author for their card.
-- Replaces the procedural vibe gradient as the dominant visual.
-- Stored as a CSS color string (e.g. "#c45a14"). Null = fall back to
-- a category-derived color in cardColor() helper.
alter table cards add column if not exists color text;
