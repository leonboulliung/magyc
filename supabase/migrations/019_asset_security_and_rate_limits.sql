-- ============================================================
-- 019 — Asset security + persistent rate limits
--
-- Direct browser uploads need server-created signed upload URLs and
-- persistent abuse controls that work across Vercel instances.
-- ============================================================

-- Public-read was convenient for the prototype. New code signs reads, so the
-- bucket can be private. Existing public URLs may stop working after this
-- migration unless they are resolved through the new signing endpoint.
insert into storage.buckets (id, name, public)
values ('space_assets', 'space_assets', false)
on conflict (id) do update
  set public = false;

drop policy if exists "space_assets_read" on storage.objects;
drop policy if exists "space_assets_write" on storage.objects;

-- No public Storage policies. Reads and signed URL creation happen through
-- service_role-backed API routes; uploads use createSignedUploadUrl tokens.

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limits_updated_idx
  on rate_limits(updated_at desc);

alter table rate_limits enable row level security;

create or replace function take_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  if p_key is null or length(p_key) < 3 or p_window_seconds < 1 or p_max < 1 then
    return false;
  end if;

  insert into rate_limits as rl (key, window_start, count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rl.window_start
      end,
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else rl.count + 1
      end,
      updated_at = v_now
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

create or replace function space_upload_usage(p_space_id text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when jsonb_typeof(data->'size') = 'number' then (data->>'size')::bigint
      when (data->>'size') ~ '^[0-9]+$' then (data->>'size')::bigint
      else 0
    end
  ), 0)::bigint
  from module_state
  where space_id = p_space_id
    and kind = 'upload';
$$;
