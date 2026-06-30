-- 027 — 30-day retention for deleted Studio presets.

alter table public.studio_presets
  add column if not exists deleted_at timestamptz;

create index if not exists studio_presets_owner_deleted_idx
  on public.studio_presets(owner_id, deleted_at, updated_at desc);

insert into public.ops_migration_log (id, description, notes)
values (
  '027',
  'Studio preset retention',
  'Soft-deleted presets remain restorable for 30 days; expired rows and their private assets are purged by the application.'
)
on conflict (id) do update
set description = excluded.description,
    notes = excluded.notes,
    applied_at = now();
