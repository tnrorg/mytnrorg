-- Who viewed whose public member profile, and for how long.
-- Visible to Super Admins only (Admin → Visitors).
--
-- ⚠ This records one member's behaviour and shows it to administrators.
-- Tell members it exists — a line in the privacy notice or the member portal.
-- A platform that logs who read whose page without saying so loses more trust
-- when it is discovered than the feature was ever worth.

create table if not exists profile_views (
  id              uuid primary key default gen_random_uuid(),

  -- Whose profile was opened. Stored as the membership number so a row still
  -- reads correctly if a member record is later removed.
  viewed_member_id   uuid,
  viewed_membership_id text not null,

  -- Who looked. NULL for a signed-out visitor: the page is public, so most
  -- traffic has no identity and that is recorded honestly rather than guessed.
  viewer_member_id     uuid,
  viewer_membership_id text,

  seconds        int not null default 0,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,

  -- Coarse only. Enough to spot a bot; not a location trail.
  user_agent     text,

  created_at     timestamptz not null default now()
);

create index if not exists idx_pv_viewed  on profile_views(viewed_membership_id, started_at desc);
create index if not exists idx_pv_viewer  on profile_views(viewer_membership_id, started_at desc);
create index if not exists idx_pv_started on profile_views(started_at desc);

alter table profile_views enable row level security;
-- No policies: only the service-role key reads or writes. A member must never
-- be able to query this table directly.

-- Housekeeping. Views older than a year are not useful and keeping them is a
-- liability rather than an asset.
create or replace function prune_profile_views()
returns void
language sql
security definer
set search_path = public
as $$
  delete from profile_views where started_at < now() - interval '365 days';
$$;
