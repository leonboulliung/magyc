-- ============================================================
-- 009 — AI observability + admin notes
--
-- Internal-only tables for seeing how MAGYC is used and debugging AI
-- behaviour. No public RLS policies are created; app reads/writes these
-- tables only through service_role from server routes.
-- ============================================================

create table if not exists ai_events (
  id           text primary key,
  user_id      text references profiles(id) on delete set null,
  anon_id      text,
  space_id     text references spaces(id) on delete set null,
  module_index int,

  event_type   text not null,
  model        text,
  status       text not null default 'ok'
               check (status in ('ok', 'error')),

  input        text,
  output       text,
  error        text,
  metadata     jsonb not null default '{}'::jsonb,

  latency_ms   int,
  tokens_in    int,
  tokens_out   int,

  created_at   timestamptz not null default now()
);

create index if not exists ai_events_created_idx
  on ai_events(created_at desc);

create index if not exists ai_events_user_idx
  on ai_events(user_id);

create index if not exists ai_events_anon_idx
  on ai_events(anon_id);

create index if not exists ai_events_space_idx
  on ai_events(space_id);

create index if not exists ai_events_type_idx
  on ai_events(event_type);

alter table ai_events enable row level security;

create table if not exists admin_notes (
  id          text primary key,
  subject_id text not null,
  subject_type text not null check (subject_type in ('user', 'space', 'anon')),
  note        text not null,
  created_by  text references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists admin_notes_subject_idx
  on admin_notes(subject_type, subject_id);

alter table admin_notes enable row level security;
