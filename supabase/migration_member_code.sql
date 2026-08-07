-- Run this in Supabase → SQL Editor if you already created the tables.
alter table members add column if not exists member_code text;
create index if not exists idx_members_code on members(member_code);
