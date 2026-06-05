-- 016 — Place character: store the Photon classification of the
-- card's location (osm_value: "restaurant", "park", "cinema", etc.).
-- The geocoder already tells us what kind of place a Thing happens
-- in; we used to throw it away after the dropdown.
--
-- Free, factual, no AI involved. Read on the detail page and on
-- the Discover surface.

alter table cards
  add column if not exists location_kind text;
