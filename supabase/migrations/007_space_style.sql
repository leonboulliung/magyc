-- ============================================================
-- 007 — Per-space visual style
--
-- Each space carries a small style object the AI assigns at creation
-- to match the input's mood, and the owner can edit afterwards:
--
--   { "font": "<Google Fonts family>",
--     "color1": "#hex",   -- text, borders, map pins
--     "color2": "#hex",   -- widget accents, map fills
--     "background": "#hex" }  -- page canvas
--
-- The element grid itself always renders white with a black dot grid,
-- independent of these colors — enforced in the client, not here.
--
-- Idempotent.
-- ============================================================

alter table spaces
  add column if not exists style jsonb;
