-- ════════════════════════════════════════════════════════════════════════════
-- Two-factor authentication for admin accounts
--
-- Safe to run more than once. Adds columns and one table; changes no existing
-- data and drops nothing.
--
-- After running this, every admin account still signs in exactly as before —
-- 2FA is inert until an admin enrols. Super admins are then prompted to enrol
-- on their next sign-in and cannot reach the dashboard until they finish.
--
-- NOTE ON JWT_SECRET: enrolled secrets are encrypted with a key derived from
-- JWT_SECRET. Rotating that value makes existing enrolments unreadable and
-- every admin must re-enrol. That is intended — a secret rotation should not
-- leave old material usable — but do not rotate it casually once 2FA is live.
-- ════════════════════════════════════════════════════════════════════════════

-- ── prerequisite: brute-force counters ──────────────────────────────────────
-- Repeated from migration_login_protection.sql on purpose.
--
-- The limits on code guessing are stored here, and lib/loginGuard.js fails
-- OPEN when the table is missing — correct for a password form, where a
-- database hiccup locking an admin out of their own panel is worse than the
-- attack. It is the wrong default for a 6-digit code, which is only safe
-- while guessing is limited. Creating the table here means 2FA cannot be
-- switched on into a state where nothing is counting.
create table if not exists login_attempts (
  scope        text not null,
  identifier   text not null,
  fails        int  not null default 0,
  first_fail   timestamptz not null default now(),
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, identifier)
);
create index if not exists idx_login_attempts_locked on login_attempts(locked_until);
alter table login_attempts enable row level security;

-- ── admin_users: enrolment state ────────────────────────────────────────────
alter table admin_users add column if not exists totp_secret_enc   text;
alter table admin_users add column if not exists totp_enabled      boolean not null default false;
alter table admin_users add column if not exists totp_confirmed_at timestamptz;
alter table admin_users add column if not exists totp_last_step    bigint  not null default 0;
alter table admin_users add column if not exists backup_codes      jsonb   not null default '[]'::jsonb;
alter table admin_users add column if not exists email             text;

comment on column admin_users.totp_secret_enc is
  'AES-256-GCM sealed base32 secret. Never plaintext. Unreadable without JWT_SECRET.';
comment on column admin_users.totp_enabled is
  'True only after the admin has proved they can generate a code. A secret alone does not enable 2FA.';
comment on column admin_users.totp_last_step is
  'Highest TOTP time step already consumed. Blocks replay of a code inside its own 90s window.';
comment on column admin_users.backup_codes is
  'Array of HMAC-SHA256 hashes. Single use — a consumed code is removed from the array.';
comment on column admin_users.email is
  'Where the email fallback code is sent. Fallback is unavailable while this is null.';

-- ── pending sign-ins ────────────────────────────────────────────────────────
-- A challenge is created once the password is correct and destroyed once the
-- code is verified. It is NOT a session: it carries no role and is accepted by
-- exactly one endpoint. This is what keeps a correct password from being a
-- complete sign-in on its own.
create table if not exists admin_2fa_challenges (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references admin_users(id) on delete cascade,
  token_hash    text not null unique,       -- the raw token is only ever in the browser
  email_code_hash text,                     -- set when the admin asks for the email fallback
  email_sent_at timestamptz,
  attempts      int  not null default 0,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '10 minutes'),
  consumed_at   timestamptz
);

create index if not exists idx_admin_2fa_challenges_token   on admin_2fa_challenges(token_hash);
create index if not exists idx_admin_2fa_challenges_expires on admin_2fa_challenges(expires_at);
create index if not exists idx_admin_2fa_challenges_admin   on admin_2fa_challenges(admin_id);

-- Denies everything to anon and authenticated. Only the server-side
-- service-role key reaches this table, exactly as with admin_users itself.
alter table admin_2fa_challenges enable row level security;

-- ── housekeeping ────────────────────────────────────────────────────────────
-- Spent and expired challenges are of no further use and holding them serves
-- nobody. Call this from a scheduled job, or ignore it — the table stays small.
create or replace function prune_admin_2fa_challenges() returns void
language sql as $$
  delete from admin_2fa_challenges
   where expires_at < now() - interval '1 day';
$$;

-- ── set an email for the fallback ───────────────────────────────────────────
-- Fill this in for each admin who should be able to receive a code by email.
-- Leave it null for accounts that should be authenticator-app only.
--
--   update admin_users set email = 'someone@example.com' where username = 'admin';

-- ── verify ──────────────────────────────────────────────────────────────────
-- Expect one row per admin. `totp_enabled` will be false for everyone until
-- they enrol; super admins are prompted at their next sign-in.
select
  u.username,
  u.role,
  u.totp_enabled,
  (u.email is not null) as email_fallback_available,
  jsonb_array_length(u.backup_codes) as backup_codes_left
from admin_users u
order by u.role, u.username;
