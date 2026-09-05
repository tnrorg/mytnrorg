-- ============================================================================
--  TNR — Admin password change and session revocation
--  Run once in the Supabase SQL editor.
--
--  WHAT THIS CLOSES
--
--  The August 2026 security audit left two things open, and they are the same
--  thing seen from two sides:
--
--    1. An ordinary admin could not change their own password. Only a super
--       admin could, from the Admin Accounts screen — which means the super
--       admin then KNOWS that person's password. A password one other person
--       has typed is not a password.
--
--    2. Admin sessions could not be revoked. Changing a password did nothing
--       to sessions already signed in: a token stayed valid for its full
--       twelve hours. So the one moment you most want a password change —
--       "someone else may have my password" — was exactly the moment it did
--       not help.
--
--  `session_epoch` fixes the second. Every token is minted carrying the epoch
--  current at sign-in; the guard compares the token's epoch against this
--  column on every request. Bump the column and every token minted before it
--  stops working — instantly, everywhere, with no session store to keep.
-- ============================================================================

alter table public.admin_users
  add column if not exists session_epoch int not null default 0;

/* When the password last changed.
 *
 * Not used for any check — it is there so that "when was this account last
 * secured" is answerable a year from now. An audit that cannot say when a
 * credential was last rotated cannot say anything useful about it. */
alter table public.admin_users
  add column if not exists password_changed_at timestamptz;

-- ============================================================================
--  Two nullable/defaulted columns. No data is altered or deleted, and every
--  existing session keeps working: tokens minted before this have no epoch
--  claim, which the guard treats as 0 — equal to the default here.
--
--  Safe to run on production, and safe to run twice.
-- ============================================================================
