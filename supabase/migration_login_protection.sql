-- Brute-force protection for the admin and member sign-in endpoints.
-- Safe to run more than once.

-- One row per (scope, identifier). Identifier is the username or email being
-- attacked, and separately the caller's IP — locking only on username lets one
-- attacker spray many accounts from one machine, and locking only on IP lets a
-- shared connection lock out a whole village.
create table if not exists login_attempts (
  scope        text not null,               -- 'admin' | 'member'
  identifier   text not null,               -- 'user:<name>' or 'ip:<addr>'
  fails        int  not null default 0,
  first_fail   timestamptz not null default now(),
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, identifier)
);

create index if not exists idx_login_attempts_locked on login_attempts(locked_until);

alter table login_attempts enable row level security;
-- No policies: only the service-role key touches this table.

-- Housekeeping: drop rows that are neither locked nor recently active, so the
-- table does not grow forever from one-off typos.
create or replace function prune_login_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from login_attempts
   where coalesce(locked_until, updated_at) < now() - interval '24 hours';
$$;
