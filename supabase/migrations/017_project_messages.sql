-- 017 — Project messages (persistent chat thread).
--
-- One continuous thread per project. Two channels share the table:
--   'magyc' — the assisting agent (role 'user' = a question, 'assistant' = its reply)
--   'team'  — participant-to-participant chat (role 'user')
-- Persisted so the thread survives reloads (the old chat lived only in client
-- state). Access is gated in the API (owner or shared); the service role writes
-- and reads, so RLS stays closed to anon by default.
create table if not exists project_messages (
  id          text primary key,
  space_id    text not null references spaces(id) on delete cascade,
  channel     text not null,                 -- 'magyc' | 'team'
  role        text not null default 'user',  -- 'user' | 'assistant'
  author_id   text,                          -- clerk user id or anon token
  author_name text,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists project_messages_space_idx
  on project_messages (space_id, channel, created_at);

alter table project_messages enable row level security;
