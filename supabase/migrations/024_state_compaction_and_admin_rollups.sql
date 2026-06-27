-- ============================================================
-- 024 — State compaction + scalable admin activity rollups
-- ============================================================

create index if not exists module_state_space_module_kind_created_idx
  on public.module_state(space_id, module_index, kind, created_at desc);

create index if not exists module_state_actor_kind_created_idx
  on public.module_state(actor_kind, actor_id, kind, created_at desc);

-- Merge repeated partial patches for one logical item into one row. The
-- advisory lock makes concurrent edits to the same item deterministic, while
-- unrelated elements continue without waiting for each other.
create or replace function public.upsert_module_edit(
  p_id text,
  p_space_id text,
  p_module_index integer,
  p_actor_kind text,
  p_actor_id text,
  p_display_name text,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_item_id text := nullif(btrim(coalesce(p_data->>'id', '')), '');
  v_merged jsonb := '{}'::jsonb;
  v_patch record;
begin
  if p_id is null or p_space_id is null or p_module_index < 0
     or p_actor_kind not in ('user', 'anon') or p_actor_id is null
     or v_item_id is null then
    raise exception 'invalid_module_edit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_space_id || ':' || p_module_index::text || ':' || v_item_id, 0)
  );

  for v_patch in
    select data
    from public.module_state
    where space_id = p_space_id
      and module_index = p_module_index
      and kind = 'edit'
      and data->>'id' = v_item_id
    order by created_at asc, id asc
  loop
    v_merged := v_merged || v_patch.data;
  end loop;

  v_merged := v_merged || p_data;

  delete from public.module_state
  where space_id = p_space_id
    and module_index = p_module_index
    and kind = 'edit'
    and data->>'id' = v_item_id;

  insert into public.module_state (
    id, space_id, module_index, actor_kind, actor_id, display_name, kind, data
  ) values (
    p_id, p_space_id, p_module_index, p_actor_kind, p_actor_id,
    p_display_name, 'edit', v_merged
  );
end;
$function$;

revoke all on function public.upsert_module_edit(text, text, integer, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_module_edit(text, text, integer, text, text, text, jsonb)
  to service_role;

-- Exact per-user counters for the paginated admin cockpit. The application
-- sends only the IDs visible on the current page, avoiding bounded global
-- snapshots and N Clerk/API calls per metric.
create or replace function public.admin_user_activity_rollup(p_user_ids text[])
returns table (
  user_id text,
  space_count bigint,
  action_count bigint,
  ai_run_count bigint,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    requested.user_id,
    coalesce(spaces.total, 0)::bigint as space_count,
    coalesce(actions.total, 0)::bigint as action_count,
    coalesce(ai.total, 0)::bigint as ai_run_count,
    greatest(
      profile.created_at,
      spaces.last_at,
      actions.last_at,
      ai.last_at,
      app.last_at,
      support.last_at
    ) as last_seen
  from unnest(coalesce(p_user_ids, array[]::text[])) as requested(user_id)
  left join public.profiles profile on profile.id = requested.user_id
  left join lateral (
    select count(*)::bigint as total, max(created_at) as last_at
    from public.spaces
    where owner_id = requested.user_id
  ) spaces on true
  left join lateral (
    select count(*)::bigint as total, max(created_at) as last_at
    from public.module_state
    where actor_kind = 'user' and actor_id = requested.user_id
  ) actions on true
  left join lateral (
    select count(*)::bigint as total, max(created_at) as last_at
    from public.ai_events
    where user_id = requested.user_id
  ) ai on true
  left join lateral (
    select max(created_at) as last_at
    from public.app_events
    where user_id = requested.user_id
       or (actor_kind = 'user' and actor_id = requested.user_id)
  ) app on true
  left join lateral (
    select max(created_at) as last_at
    from public.support_tickets
    where user_id = requested.user_id
  ) support on true;
$function$;

revoke all on function public.admin_user_activity_rollup(text[])
  from public, anon, authenticated;
grant execute on function public.admin_user_activity_rollup(text[]) to service_role;

insert into public.ops_migration_log (id, description, notes)
values (
  '024_state_compaction_and_admin_rollups',
  'Compacts item edits and adds exact paginated admin activity counters.',
  'Append-only state is additionally capped by application policy; apply after migrations 020-023.'
)
on conflict (id) do update set
  description = excluded.description,
  notes = excluded.notes;

-- Verification:
-- select routine_name from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name in ('upsert_module_edit', 'admin_user_activity_rollup');
