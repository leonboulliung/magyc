-- Following: one user follows another. Powers a "from people you follow"
-- section at the top of the field. Lightweight; like `signals` but between
-- two profiles.

create table if not exists follows (
  follower_id  text not null references profiles(id) on delete cascade,
  following_id text not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx  on follows(follower_id);
create index if not exists follows_following_idx on follows(following_id);

-- RLS — public read (follower counts / following lists are public), writes
-- only via service_role (the API routes).
alter table follows enable row level security;
drop policy if exists "follows_select_all" on follows;
create policy "follows_select_all" on follows for select using (true);
