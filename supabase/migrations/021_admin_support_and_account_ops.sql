-- Admin account operations + one-way support intake.
-- Apply manually in Supabase SQL editor.

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists account_status text not null default 'active',
  add column if not exists admin_notes text not null default '',
  add column if not exists plan_updated_at timestamptz,
  add column if not exists account_status_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_plan_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_plan_check
      check (plan in ('free', 'trial', 'pro', 'studio', 'internal'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'locked', 'banned'));
  end if;
end $$;

create table if not exists public.support_tickets (
  id text primary key,
  user_id text references public.profiles(id) on delete set null,
  email text,
  type text not null default 'problem',
  status text not null default 'new',
  message text not null,
  route text,
  space_id text references public.spaces(id) on delete set null,
  user_agent text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text references public.profiles(id) on delete set null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_tickets_type_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_type_check
      check (type in ('problem', 'question', 'wish', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'support_tickets_status_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_status_check
      check (status in ('new', 'done'));
  end if;
end $$;

create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_space_created_idx
  on public.support_tickets (space_id, created_at desc);

alter table public.support_tickets enable row level security;

create table if not exists public.admin_audit_events (
  id text primary key,
  admin_user_id text references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_events_target_type_check'
      and conrelid = 'public.admin_audit_events'::regclass
  ) then
    alter table public.admin_audit_events
      add constraint admin_audit_events_target_type_check
      check (target_type in ('user', 'space', 'support_ticket'));
  end if;
end $$;

create index if not exists admin_audit_events_admin_created_idx
  on public.admin_audit_events (admin_user_id, created_at desc);
create index if not exists admin_audit_events_target_created_idx
  on public.admin_audit_events (target_type, target_id, created_at desc);

alter table public.admin_audit_events enable row level security;

create table if not exists public.ops_migration_log (
  id text primary key,
  description text not null,
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.ops_migration_log enable row level security;

insert into public.ops_migration_log (id, description, notes)
values (
  '021_admin_support_and_account_ops',
  'Admin plan/status fields, support tickets, and admin audit events.',
  'Apply manually in Supabase SQL editor after migration 020.'
)
on conflict (id) do update set
  applied_at = now(),
  description = excluded.description,
  notes = excluded.notes;
