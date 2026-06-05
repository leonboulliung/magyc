-- Roles: a thing can declare a set of named roles ("Foto", "Tonkundige",
-- "Snacks-Pate", …) that joiners can claim with "Ich mach's". The column
-- holds an ordered array of role definitions; the `joiners.role` column
-- (already present) carries which label a given joiner has taken.
--
-- Empty array (the default) means: no predefined roles — the thing
-- behaves like before, joiners just join without claiming a slot.

alter table cards
  add column if not exists roles jsonb not null default '[]'::jsonb;
