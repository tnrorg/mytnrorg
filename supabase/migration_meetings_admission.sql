-- ═══════════════════════════════════════════════════════════════════════════
-- TNR MEETINGS — Phase 3: the waiting room
--
-- Additive only. Run AFTER supabase/migration_meetings.sql.
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

/* Admission is separate from invitation.
 *
 * invite_status answers "were they asked, and did they say yes".
 * admission answers "may they enter the room RIGHT NOW".
 *
 * They are genuinely different questions: an invited member is still held at
 * the door when the waiting room is on, and a member the host ejects mid-call
 * is still invited but must not be able to walk straight back in. Folding both
 * into one column would make "declined" and "removed by host" the same state.
 *
 * Default 'admitted' so every meeting created before this migration, and every
 * meeting with the waiting room switched off, behaves exactly as it did.
 */
alter table meeting_participants
  add column if not exists admission text not null default 'admitted',
  add column if not exists admission_at timestamptz,
  add column if not exists admitted_by uuid references membership_members(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meeting_participants_admission_valid') then
    alter table meeting_participants
      add constraint meeting_participants_admission_valid
      check (admission in ('pending','admitted','rejected','removed'));
  end if;
end $$;

-- The host's waiting-room list is polled every few seconds while a meeting
-- runs. Without this index that is a sequential scan on every poll.
create index if not exists ix_mp_waiting
  on meeting_participants(meeting_id, admission)
  where admission = 'pending';

select column_name, data_type, column_default
from information_schema.columns
where table_name = 'meeting_participants'
  and column_name in ('admission','admission_at','admitted_by')
order by column_name;
