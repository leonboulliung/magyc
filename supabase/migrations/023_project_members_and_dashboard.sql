-- ============================================================
-- 023 — Project memberships + lean Studio summaries
-- ============================================================

alter table public.spaces
  add column if not exists updated_at timestamptz;

update public.spaces set updated_at = created_at where updated_at is null;

alter table public.spaces
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.touch_space_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists spaces_touch_updated_at on public.spaces;
create trigger spaces_touch_updated_at
before update on public.spaces
for each row execute function public.touch_space_updated_at();

create table if not exists public.project_members (
  id            text primary key,
  space_id      text not null references public.spaces(id) on delete cascade,
  user_id       text references public.profiles(id) on delete set null,
  email         text not null,
  display_name  text,
  role          text not null check (role in ('editor', 'client')),
  invited_by    text not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (space_id, email)
);

create unique index if not exists project_members_space_user_idx
  on public.project_members(space_id, user_id)
  where user_id is not null;

create index if not exists project_members_user_idx
  on public.project_members(user_id, updated_at desc)
  where user_id is not null;

create index if not exists project_members_inviter_idx
  on public.project_members(invited_by, updated_at desc);

alter table public.project_members enable row level security;
-- No browser policies: membership data is read/written through service-role
-- routes so email addresses never leak through the public Supabase client.

create or replace function public.studio_project_summaries(p_user_id text)
returns table (
  id text,
  title text,
  stage text,
  segment text,
  shared boolean,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  last_activity_at timestamptz,
  state_count bigint,
  upload_count bigint,
  member_count bigint,
  access_role text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    s.id,
    s.title,
    s.stage,
    s.segment,
    coalesce(s.shared, false),
    s.archived_at,
    s.deleted_at,
    s.created_at,
    greatest(
      s.created_at,
      s.updated_at,
      coalesce(ms.last_at, s.created_at),
      coalesce(pm.last_at, s.created_at)
    ) as last_activity_at,
    coalesce(ms.total, 0)::bigint as state_count,
    coalesce(ms.uploads, 0)::bigint as upload_count,
    coalesce(mc.total, 0)::bigint as member_count,
    case when s.owner_id = p_user_id then 'owner' else membership.role end as access_role
  from public.spaces s
  left join lateral (
    select max(created_at) as last_at,
      count(*)::bigint as total,
      count(*) filter (where kind = 'upload')::bigint as uploads
    from public.module_state
    where space_id = s.id
  ) ms on true
  left join lateral (
    select max(created_at) as last_at
    from public.project_messages
    where space_id = s.id
  ) pm on true
  left join lateral (
    select count(*)::bigint as total
    from public.project_members
    where space_id = s.id
  ) mc on true
  left join public.project_members membership
    on membership.space_id = s.id and membership.user_id = p_user_id
  where s.owner_id = p_user_id or membership.user_id = p_user_id
  order by greatest(s.created_at, s.updated_at, coalesce(ms.last_at, s.created_at), coalesce(pm.last_at, s.created_at)) desc;
$function$;

revoke all on function public.studio_project_summaries(text) from public, anon, authenticated;
grant execute on function public.studio_project_summaries(text) to service_role;

insert into public.ops_migration_log (id, description, notes)
values (
  '023_project_members_and_dashboard',
  'Adds project roles and lean Studio activity summaries.',
  'Editors can change planning structure; clients can interact. Owners retain project administration.'
)
on conflict (id) do update set
  description = excluded.description,
  notes = excluded.notes;

-- Verification after applying:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'project_members'
-- order by ordinal_position;
-- select routine_name from information_schema.routines
-- where routine_schema = 'public' and routine_name = 'studio_project_summaries';
