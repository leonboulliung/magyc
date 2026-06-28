-- ============================================================
-- 026 - Explicit project invitations
-- ============================================================
-- Invitations never grant project access on their own. A verified Clerk
-- account must explicitly accept before a project_members row is created.

create table if not exists public.project_invitations (
  id            text primary key,
  space_id      text not null references public.spaces(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null check (role in ('editor', 'client')),
  invited_by    text not null references public.profiles(id) on delete cascade,
  accepted_by   text references public.profiles(id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (space_id, email)
);

create index if not exists project_invitations_email_status_idx
  on public.project_invitations(lower(email), status, created_at desc);

create index if not exists project_invitations_space_idx
  on public.project_invitations(space_id, status, created_at desc);

alter table public.project_invitations enable row level security;
-- No browser policies. The service-role API verifies Clerk email ownership.

-- Preserve legacy pending rows as invitations, then remove them from the
-- membership table so they cannot be claimed implicitly by old code.
insert into public.project_invitations (
  id, space_id, email, display_name, role, invited_by, status,
  expires_at, created_at, updated_at
)
select
  concat('invite-', pm.id), pm.space_id, lower(pm.email), pm.display_name,
  pm.role, pm.invited_by, 'pending', now() + interval '30 days',
  pm.created_at, pm.updated_at
from public.project_members pm
where pm.user_id is null
on conflict (space_id, email) do nothing;

delete from public.project_members where user_id is null;

create or replace function public.respond_project_invitation(
  p_invitation_id text,
  p_user_id text,
  p_verified_emails text[],
  p_action text
)
returns table (space_id text, role text, status text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  invitation public.project_invitations%rowtype;
  normalized_emails text[];
begin
  if p_action not in ('accept', 'decline') then
    raise exception 'invalid_invitation_action';
  end if;

  select array_agg(lower(trim(value)))
    into normalized_emails
  from unnest(coalesce(p_verified_emails, array[]::text[])) as value;

  select * into invitation
  from public.project_invitations
  where id = p_invitation_id
  for update;

  if invitation.id is null
     or invitation.status <> 'pending'
     or invitation.expires_at <= now()
     or not (lower(invitation.email) = any(coalesce(normalized_emails, array[]::text[]))) then
    return;
  end if;

  if exists (
    select 1 from public.spaces s
    where s.id = invitation.space_id and s.owner_id = p_user_id
  ) then
    raise exception 'invitation_is_owner';
  end if;

  if p_action = 'decline' then
    update public.project_invitations
    set status = 'declined', responded_at = now(), updated_at = now()
    where id = invitation.id;
    return query select invitation.space_id, invitation.role, 'declined'::text;
    return;
  end if;

  if exists (
    select 1 from public.project_members pm
    where pm.space_id = invitation.space_id and pm.user_id = p_user_id
  ) then
    update public.project_members
    set role = invitation.role,
        display_name = coalesce(invitation.display_name, display_name),
        invited_by = invitation.invited_by,
        updated_at = now()
    where space_id = invitation.space_id and user_id = p_user_id;
  else
    insert into public.project_members (
      id, space_id, user_id, email, display_name, role, invited_by,
      created_at, updated_at
    ) values (
      concat('member-', replace(gen_random_uuid()::text, '-', '')),
      invitation.space_id, p_user_id, lower(invitation.email),
      invitation.display_name, invitation.role, invitation.invited_by,
      now(), now()
    )
    on conflict (space_id, email) do update set
      user_id = excluded.user_id,
      display_name = coalesce(excluded.display_name, public.project_members.display_name),
      role = excluded.role,
      invited_by = excluded.invited_by,
      updated_at = now();
  end if;

  update public.project_invitations
  set status = 'accepted', accepted_by = p_user_id,
      responded_at = now(), updated_at = now()
  where id = invitation.id;

  return query select invitation.space_id, invitation.role, 'accepted'::text;
end;
$function$;

revoke all on function public.respond_project_invitation(text, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.respond_project_invitation(text, text, text[], text)
  to service_role;

insert into public.ops_migration_log (id, description, notes)
values (
  '026_project_invitations',
  'Separates pending invitations from accepted project memberships.',
  'A verified Clerk account must explicitly accept before access is granted.'
)
on conflict (id) do update set
  description = excluded.description,
  notes = excluded.notes;
