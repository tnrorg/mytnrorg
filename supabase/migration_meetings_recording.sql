-- ═══════════════════════════════════════════════════════════════════════════
-- TNR MEETINGS — Phase 5: recording
--
-- Additive only. Run AFTER supabase/migration_meetings.sql.
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

/* The provider's own handle for a recording in progress.
 *
 * Needed because the file does not exist yet when Start Recording is pressed —
 * LiveKit calls back minutes later with the URL, and the egress id is the only
 * thing linking that callback to this meeting. See app/api/webhooks/livekit.
 */
alter table meeting_recordings
  add column if not exists provider_egress_id text,
  add column if not exists started_by uuid references membership_members(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists stopped_at timestamptz;

-- The webhook looks a row up by this and nothing else, on every callback.
create unique index if not exists uq_recording_egress
  on meeting_recordings(provider_egress_id)
  where provider_egress_id is not null;

select column_name, data_type
from information_schema.columns
where table_name = 'meeting_recordings'
order by ordinal_position;


-- ── Reminders ──────────────────────────────────────────────────────────────
/* Stamped when the "starts in an hour" notice goes out.
 *
 * This is what makes the reminder send ONCE. The sweep runs opportunistically
 * on list reads (there is no scheduler in this project), so without it every
 * page load in the hour before a meeting would notify the whole invitation
 * list again. The conditional update on this column is also the lock that
 * stops two simultaneous requests both sending. See sendMeetingReminders().
 */
alter table meetings
  add column if not exists reminded_at timestamptz;

-- The sweep filters on exactly this pair, on every list read.
create index if not exists ix_meetings_reminder
  on meetings(scheduled_at)
  where status = 'scheduled' and reminded_at is null;
