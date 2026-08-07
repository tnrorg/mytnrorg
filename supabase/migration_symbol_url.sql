-- Candidate symbol image / flag. Run in Supabase → SQL Editor.
alter table candidates add column if not exists symbol_url text;
