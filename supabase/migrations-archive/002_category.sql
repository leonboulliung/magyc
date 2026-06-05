-- Add explicit category column. Old rows stay null and fall back to
-- the title-derived activity inside computeVibe().
alter table cards add column if not exists category text;
