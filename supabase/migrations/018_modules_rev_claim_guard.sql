-- ============================================================
-- 018 — Module revision + claim race guard + state indexes
--
-- Structural widget edits rewrite spaces.modules. modules_rev lets the
-- API reject stale writes instead of silently overwriting another tab's
-- newer module array.
--
-- Claims are collaborative state rows. A partial unique index makes
-- "one active claim per slot" true even under simultaneous clicks.
-- ============================================================

alter table spaces
  add column if not exists modules_rev integer not null default 0;

create index if not exists spaces_modules_rev_idx
  on spaces(id, modules_rev);

with duplicate_active_claims as (
  select id,
    row_number() over (
      partition by space_id, module_index, data->>'slotLabel'
      order by created_at desc, id desc
    ) as duplicate_rank
  from module_state
  where kind = 'claim'
    and data ? 'slotLabel'
    and coalesce(data->>'claimed', 'true') <> 'false'
)
delete from module_state using duplicate_active_claims
where module_state.id = duplicate_active_claims.id
  and duplicate_active_claims.duplicate_rank > 1;

create unique index if not exists module_state_active_claim_unique_idx
  on module_state(space_id, module_index, (data->>'slotLabel'))
  where kind = 'claim'
    and coalesce(data->>'claimed', 'true') <> 'false';

create index if not exists module_state_space_module_created_idx
  on module_state(space_id, module_index, created_at desc);

create index if not exists module_state_actor_recent_idx
  on module_state(actor_kind, actor_id, created_at desc);
