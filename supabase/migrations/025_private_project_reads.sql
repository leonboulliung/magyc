-- ============================================================
-- 025 — Private project reads after scoped snapshot cutover
-- Apply only after the authorized snapshot APIs are deployed and verified.
-- Apply after migration 024.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.module_state enable row level security;
alter table public.space_versions enable row level security;

-- Historical policies exposed complete project rows to the anon browser
-- client. Reads now flow through role-gated server snapshot endpoints.
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "spaces_select_all" on public.spaces;
drop policy if exists "module_state_select_all" on public.module_state;
drop policy if exists "space_versions_select_all" on public.space_versions;

revoke select on table public.profiles from anon, authenticated;
revoke select on table public.spaces from anon, authenticated;
revoke select on table public.module_state from anon, authenticated;
revoke select on table public.space_versions from anon, authenticated;

-- State collaboration now broadcasts data-free invalidations. Remove the old
-- row-change stream so future policy work cannot accidentally re-expose rows.
do $block$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'module_state'
  ) then
    execute 'alter publication supabase_realtime drop table public.module_state';
  end if;
end;
$block$;

insert into public.ops_migration_log (id, description, notes)
values (
  '025_private_project_reads',
  'Removes public project/profile reads after the authorized snapshot cutover.',
  'Apply only after production verifies /api/spaces/[id], version snapshots, broadcast invalidation, and the owner/editor/client/link matrix.'
)
on conflict (id) do update set
  description = excluded.description,
  notes = excluded.notes;

-- Verification: these queries should return no public select policies/grants.
-- select tablename, policyname from pg_policies
-- where schemaname = 'public'
--   and tablename in ('profiles', 'spaces', 'module_state', 'space_versions');
--
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('profiles', 'spaces', 'module_state', 'space_versions')
--   and grantee in ('anon', 'authenticated')
--   and privilege_type = 'SELECT';

-- Emergency rollback (restores the former broad-read posture):
-- grant select on public.profiles, public.spaces, public.module_state,
--   public.space_versions to anon, authenticated;
-- create policy "profiles_select_all" on public.profiles for select using (true);
-- create policy "spaces_select_all" on public.spaces for select using (true);
-- create policy "module_state_select_all" on public.module_state for select using (true);
-- create policy "space_versions_select_all" on public.space_versions for select using (true);
