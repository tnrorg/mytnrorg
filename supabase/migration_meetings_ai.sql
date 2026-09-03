-- ═══════════════════════════════════════════════════════════════════════════
-- TNR MEETINGS — AI transcription and draft minutes
--
-- Additive only. Run AFTER supabase/migration_meetings.sql.
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

/* The transcript, kept apart from the summary.
 *
 * They are different things with different lifetimes: a transcript is raw
 * evidence and is written once, a summary is a draft that gets regenerated,
 * edited and eventually approved. Folding them together would mean
 * regenerating a summary re-ran the expensive transcription, and an hour of
 * audio is by far the costliest call in this application.
 */
create table if not exists meeting_transcripts (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references meetings(id) on delete cascade,

  transcript_text text,
  -- Whisper's own detection. NOT forced to English: TNR meetings switch
  -- between Urdu and English mid-sentence, and pinning a language makes the
  -- model translate rather than transcribe.
  language        text,
  -- Timestamped segments, so a long recording can be stitched in order and a
  -- reviewer can find the moment a decision was made.
  segments        jsonb,
  duration_seconds int,

  provider        text not null default 'groq',
  model           text,
  status          text not null default 'processing'
                  check (status in ('processing','ready','failed')),
  error           text,

  /* ONE transcript per meeting.
   *
   * The database constraint is what stops a second "Generate" click starting a
   * second hour of billable transcription while the first is still running.
   * A check in the API would lose that race; a unique index cannot. */
  unique (meeting_id),

  created_by      uuid references membership_members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ix_mt_meeting on meeting_transcripts(meeting_id);


/* The AI draft, kept apart from meeting_minutes.
 *
 * meeting_minutes stays the human record — what the committee adopted. This
 * holds what the model proposed, so the two are never confused: a reviewer can
 * see the original draft alongside their edits, and an approved set of minutes
 * is provably something a person signed off rather than something generated.
 */
create table if not exists meeting_ai_summaries (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,

  summary_json  jsonb not null,
  language      text not null default 'english',

  provider      text not null default 'groq',
  model         text,

  review_status text not null default 'draft'
                check (review_status in ('draft','edited','approved','discarded')),

  generated_by  uuid references membership_members(id) on delete set null,
  approved_by   uuid references membership_members(id) on delete set null,
  approved_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ix_mas_meeting on meeting_ai_summaries(meeting_id, created_at desc);


/* Where the transcribable audio lives.
 *
 * Separate from the video recording: Groq's speech endpoint takes ~25 MB, an
 * hour of composite MP4 is far past that, and there is no ffmpeg in a
 * serverless runtime to extract the audio. So an audio-only egress runs
 * alongside the video and its URL is stored here. See startAudioRecording().
 */
alter table meeting_recordings
  add column if not exists is_audio_only boolean not null default false;

alter table meeting_minutes
  -- Marks minutes that began life as an AI draft, so an approved record still
  -- says where it came from.
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_summary_id uuid references meeting_ai_summaries(id) on delete set null;


-- ── Row Level Security ─────────────────────────────────────────────────────
-- Closed, like every other meetings table. The server-side route guard is the
-- real control; see the note at the top of migration_meetings.sql.
do $$
declare t text;
begin
  foreach t in array array['meeting_transcripts','meeting_ai_summaries']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop trigger if exists trg_touch_%1$s on %1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on %1$I
       for each row execute function tnr_touch_updated_at()', t);
  end loop;
end $$;


select table_name,
       (select count(*) from information_schema.columns c
         where c.table_name = t.table_name and c.table_schema = 'public') as columns
from information_schema.tables t
where table_schema = 'public'
  and table_name in ('meeting_transcripts','meeting_ai_summaries')
order by table_name;
