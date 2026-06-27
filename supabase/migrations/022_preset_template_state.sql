-- ============================================================
-- 022 — Preset template state
--
-- Preset modules keep their immutable/configuration shape in `modules`.
-- Interactions authored through the real widget UI (entries, edits, media)
-- live in a separate template-state plane and are materialized into
-- `module_state` when a project is created.
-- ============================================================

alter table public.studio_presets
  add column if not exists template_state jsonb not null default '[]'::jsonb;

alter table public.studio_presets
  drop constraint if exists studio_presets_template_state_array;

alter table public.studio_presets
  add constraint studio_presets_template_state_array
  check (jsonb_typeof(template_state) = 'array');

comment on column public.studio_presets.template_state is
  'Sanitized widget state template. Materialized into module_state on project creation.';

insert into public.ops_migration_log (id, description, notes)
values (
  '022_preset_template_state',
  'Adds first-class preset widget state and media references.',
  'Apply before using media or interactive entries in Studio presets.'
)
on conflict (id) do update set
  description = excluded.description,
  notes = excluded.notes;
