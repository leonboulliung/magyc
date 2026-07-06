-- ============================================================
-- 019 — Stable module ids for collaborative state
-- ============================================================
--
-- Collaborative state (module_state) has always been keyed by the module's
-- POSITION in spaces.modules (module_index). Reordering or deleting an
-- element required a fragile, non-atomic reindex of every downstream row;
-- when it slipped, content leaked into the wrong widget (e.g. a parts-list's
-- images surfacing inside a moodboard) or vanished until reload.
--
-- The cure: every module now carries a permanent `id` (assigned by the
-- sanitizer, backfilled for existing rows by scripts/backfill-module-ids.ts).
-- State is associated to its widget by that id, not by position, so reorder
-- and delete can never rebind state to the wrong element.
--
-- This migration only touches the DB: it adds the nullable column + a lookup
-- index, and adds an id-aware overload of upsert_module_edit. The row backfill
-- runs from the application (service-role) after deploy.

alter table public.module_state
  add column if not exists module_id text;

create index if not exists module_state_space_module_id_idx
  on public.module_state(space_id, module_id);

-- id-aware edit compaction. A new overload (8 args) so deploying the calling
-- code before this migration simply falls back to the append path — which
-- already stamps module_id — instead of erroring. When p_module_id is given
-- we scope the merge/lock by it (position-independent); otherwise we keep the
-- legacy module_index scoping for pre-id rows.
create or replace function public.upsert_module_edit(
  p_id text,
  p_space_id text,
  p_module_index integer,
  p_module_id text,
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
  v_scope text := coalesce(p_module_id, p_module_index::text);
begin
  if p_id is null or p_space_id is null or p_module_index < 0
     or p_actor_kind not in ('user', 'anon') or p_actor_id is null
     or v_item_id is null then
    raise exception 'invalid_module_edit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_space_id || ':' || v_scope || ':' || v_item_id, 0)
  );

  for v_patch in
    select data
    from public.module_state
    where space_id = p_space_id
      and (case when p_module_id is not null then module_id = p_module_id
                else module_index = p_module_index end)
      and kind = 'edit'
      and data->>'id' = v_item_id
    order by created_at asc, id asc
  loop
    v_merged := v_merged || v_patch.data;
  end loop;

  v_merged := v_merged || p_data;

  delete from public.module_state
  where space_id = p_space_id
    and (case when p_module_id is not null then module_id = p_module_id
              else module_index = p_module_index end)
    and kind = 'edit'
    and data->>'id' = v_item_id;

  insert into public.module_state (
    id, space_id, module_index, module_id, actor_kind, actor_id, display_name, kind, data
  ) values (
    p_id, p_space_id, p_module_index, p_module_id, p_actor_kind, p_actor_id,
    p_display_name, 'edit', v_merged
  );
end;
$function$;

revoke all on function public.upsert_module_edit(text, text, integer, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_module_edit(text, text, integer, text, text, text, text, jsonb)
  to service_role;
