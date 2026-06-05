-- Extend profiles with social handles and a list of interests
-- (which categories the user cares about). Both nullable.
alter table profiles add column if not exists socials jsonb;
alter table profiles add column if not exists interests text[];
