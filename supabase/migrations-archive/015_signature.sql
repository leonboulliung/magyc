-- 015 — Card signature: a small bundle of design parameters the app
-- uses to tune its existing visuals (type weight, color palette, pin
-- rhythm, map warmth) toward this particular thing.
--
-- The signature is computed by the AI from title + description + tags
-- + module immediately after POST (and on PATCH when those fields
-- change). It's never an artwork — only the tuning knobs that the
-- existing UI already supports.
--
-- Shape:
--   {
--     "palette": ["#hex", "#hex"],   // 2 harmonious accents
--     "warmth": 0..1,                 // map / hero bias
--     "tempo": 0..1,                  // pin pulse base rate
--     "weight": 100..900,             // editorial type weight
--     "geometry": "round"|"sharp"|"soft"|"linear",
--     "density": 0..1,                // surface filling rhythm
--     "kinetic": 0..1                 // motion intensity
--   }

alter table cards
  add column if not exists signature jsonb;
