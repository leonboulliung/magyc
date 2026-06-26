-- ============================================================
-- 020 — Operations foundation
--
-- Adds row-level contract versioning, app-level operations events,
-- upload usage rollups for support/admin work, and a manual migration log.
-- ============================================================

alter table spaces
  add column if not exists contract_version text;

update spaces
set contract_version = '1.5.0'
where contract_version is null;

alter table spaces
  alter column contract_version set default '1.6.0',
  alter column contract_version set not null;

comment on column spaces.contract_version is
  'MAGYC data contract version used when this space row was created.';

create table if not exists app_events (
  id text primary key,
  event_type text not null,
  status text not null default 'ok'
    check (status in ('ok', 'warn', 'error')),
  route text,
  method text,
  user_id text,
  anon_id text,
  actor_kind text check (actor_kind is null or actor_kind in ('user', 'anon')),
  actor_id text,
  space_id text references spaces(id) on delete set null,
  latency_ms integer,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_idx
  on app_events(created_at desc);

create index if not exists app_events_space_created_idx
  on app_events(space_id, created_at desc)
  where space_id is not null;

create index if not exists app_events_type_status_idx
  on app_events(event_type, status, created_at desc);

alter table app_events enable row level security;

-- No public policies: app_events are written/read through service_role-backed
-- API routes only. This keeps operational metadata out of client sessions.

create or replace function space_upload_usage_by_space(p_limit integer default 250)
returns table(space_id text, upload_count bigint, total_bytes bigint)
language sql
stable
security definer
set search_path = public
as $function$
  select
    ms.space_id,
    count(*)::bigint as upload_count,
    coalesce(sum(
      case
        when jsonb_typeof(ms.data->'size') = 'number' then (ms.data->>'size')::bigint
        when (ms.data->>'size') ~ '^[0-9]+$' then (ms.data->>'size')::bigint
        else 0
      end
    ), 0)::bigint as total_bytes
  from module_state ms
  where ms.kind = 'upload'
  group by ms.space_id
  order by total_bytes desc
  limit greatest(1, least(coalesce(p_limit, 250), 1000));
$function$;

create table if not exists ops_migration_log (
  id text primary key,
  description text not null,
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table ops_migration_log enable row level security;

insert into ops_migration_log (id, description, notes)
values (
  '020_operations_foundation',
  'Contract version column, app_events, upload usage rollup, manual migration log.',
  'Apply manually in Supabase SQL editor together with the matching application deploy.'
)
on conflict (id) do nothing;
