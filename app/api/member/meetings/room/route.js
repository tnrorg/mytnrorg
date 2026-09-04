import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { roleInMeeting, isHostLike, meetingRunSeconds, attendanceStatusFor, mergedAttendanceSeconds } from '@/lib/meetings';
import { loadMeetingFor, notifyMeeting, MEMBER_FIELDS } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* In-room operations: leaving, the waiting room, and ending the meeting.
 *
 * Every action re-derives the caller's standing from the database. Being in
 * the room is not authority to do anything — a participant who guesses the
 * shape of an "admit" request is still a participant.
 */

// ── Host: who is waiting ──
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('meeting_id') || '').trim();

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  const role = meeting ? roleInMeeting(meeting, member.id, participation) : null;
  if (!meeting || !role) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // A participant asking who is in the lobby gets their OWN status and nothing
  // else. The queue is a list of members, and that is the host's to see.
  if (!isHostLike(role))
    return ok({ waiting: [], my_admission: participation?.admission || 'admitted' });

  const sb = supabaseAdmin();
  const { data: rows } = await sb.from('meeting_participants')
    .select('id, member_id, admission, admission_at')
    .eq('meeting_id', id).eq('admission', 'pending').order('admission_at');

  let people = [];
  if (rows?.length) {
    const { data: mem } = await sb.from('membership_members')
      .select(MEMBER_FIELDS).in('id', rows.map(r => r.member_id));
    const by = Object.fromEntries((mem || []).map(m => [m.id, m]));
    people = rows.map(r => ({ ...r, member: by[r.member_id] || null }));
  }
  return ok({ waiting: people, my_admission: 'admitted', status: meeting.status });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const id = String(b.meeting_id || '').trim();
  const sb = supabaseAdmin();

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  const role = meeting ? roleInMeeting(meeting, member.id, participation) : null;
  if (!meeting || !role) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });
  const host = isHostLike(role);

  // ── Anyone: I am leaving ──
  /* Closes the OPEN session only. A member who has connected three times has
   * three rows; closing them all would credit them for time they were not
   * connected, which is the whole failure the session table exists to avoid. */
  if (b.action === 'leave') {
    const { data: open } = await sb.from('meeting_attendance_sessions')
      .select('id').eq('meeting_id', id).eq('member_id', member.id)
      .is('left_at', null).order('joined_at', { ascending: false }).limit(1).maybeSingle();

    if (open) {
      await sb.from('meeting_attendance_sessions')
        .update({ left_at: new Date().toISOString(), disconnect_reason: String(b.reason || 'left').slice(0, 40) })
        .eq('id', open.id);
    }
    await sb.from('meeting_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('meeting_id', id).eq('member_id', member.id);

    await rollUpAttendance(sb, meeting, member.id);
    return ok({ message: 'Left the meeting.' });
  }

  // ── Everything below is host-only ──
  if (!host) return fail('FORBIDDEN', 403, { message: 'Only the host can do that.' });

  if (b.action === 'admit' || b.action === 'reject' || b.action === 'remove') {
    const targets = Array.isArray(b.member_ids) ? b.member_ids.map(String)
      : b.member_id ? [String(b.member_id)] : [];
    if (!targets.length) return fail('INVALID', 400, { message: 'Nobody selected.' });

    // The host cannot eject themselves and leave a meeting nobody can end.
    const safe = targets.filter(t => t !== String(meeting.host_id));
    if (!safe.length) return fail('INVALID', 400, { message: 'The host cannot be removed.' });

    const admission = b.action === 'admit' ? 'admitted'
      : b.action === 'reject' ? 'rejected' : 'removed';

    await sb.from('meeting_participants').update({
      admission, admission_at: new Date().toISOString(), admitted_by: member.id,
    }).eq('meeting_id', id).in('member_id', safe);

    /* Removing means DISCONNECTING them, not just flagging the row.
     *
     * The flag stops them getting a new token; without this they would stay
     * in the meeting they had just been removed from until they chose to
     * leave, which is not what "remove" means to the host who pressed it. */
    if (admission === 'removed' || admission === 'rejected') {
      const { ejectParticipant } = await import('@/lib/livekit');
      for (const t of safe) {
        try { await ejectParticipant(meeting.room_id, t); }
        catch { /* already gone, or the room has ended */ }
      }
    }

    /* Removing someone also closes their attendance session. They were in the
     * room until this moment and the record should say so — leaving the
     * session open would keep counting time after they were disconnected. */
    if (admission === 'removed') {
      const { data: open } = await sb.from('meeting_attendance_sessions')
        .select('id, member_id').eq('meeting_id', id).in('member_id', safe).is('left_at', null);
      for (const s of (open || [])) {
        await sb.from('meeting_attendance_sessions')
          .update({ left_at: new Date().toISOString(), disconnect_reason: 'removed_by_host' })
          .eq('id', s.id);
        await rollUpAttendance(sb, meeting, s.member_id);
      }
    }

    return ok({ message: `${safe.length} ${admission}.`, count: safe.length });
  }

  /* ── Microphone moderation ──
   *
   * Identity in the LiveKit room is the member's uuid — set by the server when
   * the token was minted, never sent up by a client. So a host names a MEMBER
   * and this route resolves it; a browser cannot name an arbitrary identity
   * and mute a stranger in someone else's room. */
  if (b.action === 'mute_participant' || b.action === 'ask_unmute') {
    const targets = Array.isArray(b.member_ids) ? b.member_ids.map(String)
      : b.member_id ? [String(b.member_id)] : [];
    if (!targets.length) return fail('INVALID', 400, { message: 'Nobody selected.' });

    // Only people actually on this meeting. A host of meeting A must not be
    // able to reach into meeting B by passing a member id from it.
    const { data: onList } = await sb.from('meeting_participants')
      .select('member_id').eq('meeting_id', id).in('member_id', targets);
    const allowed = (onList || []).map(r => String(r.member_id));
    if (!allowed.length) return fail('NOT_FOUND', 404, { message: 'Not in this meeting.' });

    const { forceMuteAudio, askToUnmute } = await import('@/lib/livekit');
    let done = 0;
    for (const t of allowed) {
      try {
        if (b.action === 'mute_participant') { await forceMuteAudio(meeting.room_id, t); }
        else { await askToUnmute(meeting.room_id, t, member.full_name || 'The host'); }
        done += 1;
      } catch { /* someone who has already left is not a failure */ }
    }

    return ok({
      count: done,
      message: b.action === 'mute_participant'
        ? `${done} participant(s) muted.`
        : `Asked ${done} participant(s) to unmute.`,
    });
  }

  /* Mute everyone but the hosts — the control a chair actually reaches for
   * when a session of thirty descends into crosstalk. */
  if (b.action === 'mute_all') {
    const { forceMuteEveryone } = await import('@/lib/livekit');
    const keep = [meeting.host_id, ...(meeting.co_host_ids || [])].filter(Boolean);
    let muted = 0;
    try { muted = await forceMuteEveryone(meeting.room_id, keep); }
    catch { return fail('MUTE_FAILED', 502, { message: 'Could not reach the meeting server.' }); }
    return ok({ count: muted, message: `${muted} participant(s) muted.` });
  }

  /* ── Recording ──
   *
   * Host-only, and only when the meeting was CREATED with recording allowed.
   * A host cannot decide mid-session to record a committee that was told it
   * would not be — the setting is part of what the invitation promised. */
  if (b.action === 'start_recording' || b.action === 'stop_recording') {
    if (!meeting.recording_enabled)
      return fail('NOT_ALLOWED', 403, {
        message: 'Recording was not enabled for this meeting. Edit the meeting to allow it.',
      });

    const lk = await import('@/lib/livekit');
    if (!lk.livekitConfig().configured)
      return fail('VIDEO_NOT_CONFIGURED', 503, { message: 'Recording needs the LiveKit credentials.' });

    if (b.action === 'start_recording') {
      // Never two at once: a second egress would bill twice and produce two
      // half-useful files of the same meeting.
      const already = await lk.activeRecording(meeting.room_id).catch(() => null);
      if (already?.egressId)
        return ok({ egress_id: already.egressId, unchanged: true, message: 'Already recording.' });

      let started;
      try { started = await lk.startRecording(meeting.room_id, id); }
      catch (e) {
        /* Pass LiveKit's OWN words through.
         *
         * The previous message guessed a cause — "recording has to be enabled
         * on the project first" — which is wrong: egress is available on every
         * LiveKit plan including the free Build tier. A confident wrong
         * diagnosis sends an administrator hunting for a setting that does not
         * exist, which is worse than no diagnosis at all.
         *
         * The two real causes are named below, chosen from the provider's own
         * error, and that error is passed through so the right one is obvious. */
        const detail = String(e?.message || '').slice(0, 200);

        /* The cause we can name exactly, because we checked for it ourselves.
         *
         * LiveKit requires a storage destination on every file output. Without
         * one it answers "request has missing or invalid field: output", which
         * tells an administrator nothing about what to actually do. This is
         * thrown before the request is sent, so the message can name the
         * missing variables. */
        if (e?.name === 'RecordingNotConfigured') {
          return fail('RECORDING_NOT_CONFIGURED', 503, {
            message: 'Recording is not set up yet. LiveKit has to be told where to put the '
              + 'file — there is no default storage.',
            detail: `Set these in Vercel: ${(e.missing || []).join(', ')}. `
              + 'Supabase Storage works: create a bucket, then Storage → S3 Access Keys.',
          });
        }

        const quota = /quota|limit|exceed|allowance|insufficient|billing/i.test(detail);
        const busy = /concurren|too many|in use|already/i.test(detail);
        // Belt and braces: if the check above is ever bypassed, still explain
        // this particular refusal rather than passing it through raw.
        const noOutput = /missing or invalid field: output|invalid.*output/i.test(detail);

        return fail('RECORDING_FAILED', 502, {
          message: noOutput
            ? 'Recording storage is not configured, so LiveKit refused the request. '
              + 'Set LIVEKIT_S3_BUCKET, LIVEKIT_S3_ACCESS_KEY, LIVEKIT_S3_SECRET and '
              + 'LIVEKIT_S3_ENDPOINT in Vercel.'
            : quota
            ? 'The LiveKit recording allowance for this month has run out. The free Build plan '
              + 'includes 60 transcode minutes per month, and recording uses them.'
            : busy
              ? 'LiveKit is already running its maximum number of recordings. Free projects allow '
                + 'two at once — stop another recording and try again.'
              : 'The meeting server refused to start recording.',
          detail,
        });
      }

      await sb.from('meeting_recordings').insert({
        meeting_id: id, provider: 'livekit',
        provider_egress_id: started.egressId,
        status: 'processing',
        started_by: member.id, started_at: new Date().toISOString(),
        created_by: member.full_name || member.membership_id,
      });

      /* A SECOND, audio-only egress, for transcription.
       *
       * IT COSTS AS MUCH AS THE VIDEO. Both are composite egresses and both
       * bill as transcode minutes, so recording with transcription burns the
       * allowance at DOUBLE the rate — and LiveKit's free Build plan includes
       * 60 transcode minutes a month, which is one thirty-minute meeting.
       * It also uses the second of only two concurrent egress slots.
       *
       * So it is OPT-IN rather than automatic: set MEETINGS_AI_AUDIO=1 once
       * the plan can carry it. Without it a meeting records normally and
       * simply cannot be transcribed, which is the right default for an
       * organisation that has not decided to pay for this yet.
       *
       * Groq's speech endpoint takes about 25 MB; an hour of composite MP4 is
       * far past that, and Vercel's runtime has no ffmpeg to extract the audio
       * from it. Capturing audio AS audio is the only way transcription works
       * at all — see startAudioRecording(). */
      /* WHY THE AUDIO TRACK FAILED, IF IT DID.
       *
       * This used to be `catch { }` — the failure was swallowed whole. The
       * host saw "Recording started", every meeting recorded video only, and
       * there was no trace anywhere of why. That is the exact silent-failure
       * pattern this codebase has been bitten by four times, and I wrote it
       * here myself.
       *
       * The audio track is NOT essential — the video recording is already
       * running and must not be rolled back because transcription is
       * unavailable. So the failure is reported, not thrown: the host is told
       * plainly, in the same toast, that the meeting is recording but will not
       * be transcribable, and why. */
      let audioNote = null;
      if (process.env.MEETINGS_AI_AUDIO !== '1') {
        audioNote = 'Audio-only capture is off, so this meeting cannot be transcribed. '
          + 'Set MEETINGS_AI_AUDIO=1 to enable it.';
      } else {
        try {
          const a = await lk.startAudioRecording(meeting.room_id, id);
          const { error: insErr } = await sb.from('meeting_recordings').insert({
            meeting_id: id, provider: 'livekit',
            provider_egress_id: a.egressId,
            status: 'processing', is_audio_only: true,
            started_by: member.id, started_at: new Date().toISOString(),
            created_by: member.full_name || member.membership_id,
          });
          /* A failed INSERT is its own silent failure: the egress runs, the
           * file lands in the bucket, and nothing in the database points at
           * it — so the AI screen reports no audio for a meeting that has
           * some. `is_audio_only` arrives in migration_meetings_ai.sql, and
           * without that migration this is exactly what happens. */
          if (insErr) {
            audioNote = 'The audio track started but could not be recorded in the database'
              + (/is_audio_only/.test(insErr.message || '')
                ? ' — run supabase/migration_meetings_ai.sql.'
                : `: ${String(insErr.message || '').slice(0, 120)}`);
          }
        } catch (e) {
          const why = String(e?.message || '').slice(0, 160);
          audioNote = e?.name === 'RecordingNotConfigured'
            ? 'The audio track for transcription could not start: recording storage is not '
              + 'configured.'
            : /concurren|too many|in use/i.test(why)
              ? 'The audio track could not start — LiveKit allows only two recordings at once, '
                + 'and the video recording is using one. A paid plan raises this limit.'
              : /quota|limit|exceed|allowance|billing/i.test(why)
                ? 'The audio track could not start — the LiveKit transcode allowance has run out. '
                  + 'Audio and video are billed separately, so recording with transcription '
                  + 'spends it twice as fast.'
                : `The audio track for transcription could not start: ${why}`;
        }
      }

      return ok({
        egress_id: started.egressId,
        audio_warning: audioNote || undefined,
        message: 'Recording started. Everyone can see the indicator.'
          + (audioNote ? ` ${audioNote}` : ''),
      });
    }

    // BOTH egresses — the video and the audio-only track started alongside it.
    const { data: live } = await sb.from('meeting_recordings')
      .select('id, provider_egress_id').eq('meeting_id', id).eq('status', 'processing');
    if (!live?.length) return ok({ unchanged: true, message: 'Nothing is recording.' });

    for (const r of live) {
      try { await lk.stopRecording(r.provider_egress_id); }
      catch { /* already stopped its end; the webhook will still close the row */ }
    }

    await sb.from('meeting_recordings')
      .update({ stopped_at: new Date().toISOString() }).in('id', live.map(r => r.id));

    // The file is NOT ready yet — LiveKit finishes encoding and calls the
    // webhook. Saying so avoids an admin refreshing an empty Recording tab.
    return ok({ message: 'Recording stopped. The file appears on the meeting record once it has processed.' });
  }

  if (b.action === 'lock') {
    await sb.from('meetings').update({ locked: !!b.locked }).eq('id', id);
    return ok({ message: b.locked ? 'Meeting locked.' : 'Meeting unlocked.' });
  }

  // ── End for everyone ──
  if (b.action === 'end') {
    /* THE HOST ALONE, not any co-host.
     *
     * Every other host power — admit, mute, eject — is shared with co-hosts on
     * purpose, so the day keeps running if the chair's connection drops. But
     * ENDING is different in kind: it is irreversible, it finalises everyone's
     * attendance, and it throws every person out of the room at once.
     *
     * This became urgent when interview panels were made co-hosts: a panel of
     * six meant six people could end a session in front of thirty waiting
     * candidates, and any one of them could do it by mis-tapping on a phone.
     * Nobody should hold that by accident. */
    if (role !== 'host') {
      return fail('HOST_ONLY', 403, {
        message: 'Only the meeting host can end the meeting for everyone. '
          + 'You can leave the meeting yourself, and it will carry on.',
      });
    }
    const now = new Date().toISOString();
    const { data: ended } = await sb.from('meetings')
      .update({ status: 'completed', ended_at: now }).eq('id', id).select('*').single();

    /* Close every session still open, THEN roll up.
     *
     * People do not press Leave — they close the tab, or their phone dies. If
     * the sessions were left open, everyone still connected when the host
     * ended would show a null duration and be recorded absent, which is the
     * opposite of the truth: they stayed to the end. */
    const { data: open } = await sb.from('meeting_attendance_sessions')
      .select('id, member_id').eq('meeting_id', id).is('left_at', null);
    if (open?.length) {
      await sb.from('meeting_attendance_sessions')
        .update({ left_at: now, disconnect_reason: 'meeting_ended' })
        .in('id', open.map(s => s.id));
    }

    const { data: everyone } = await sb.from('meeting_attendance_sessions')
      .select('member_id').eq('meeting_id', id);
    for (const mid of [...new Set((everyone || []).map(s => s.member_id))]) {
      await rollUpAttendance(sb, ended, mid);
    }

    // Anyone who never connected is marked missed.
    await sb.from('meeting_participants').update({ invite_status: 'missed' })
      .eq('meeting_id', id).is('joined_at', null).in('invite_status', ['invited', 'accepted']);

    await notifyMeeting(ended, 'completed', { actorId: member.id });
    return ok({ message: 'Meeting ended for everyone.' });
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}

/* Sum a member's sessions into the attendance row.
 *
 * Recomputed from the sessions every time rather than incremented, so a
 * duplicate call, a retry, or a session closed twice cannot inflate anyone's
 * total. The sessions are the truth; this table is a cache of them.
 */
async function rollUpAttendance(sb, meeting, memberId) {
  const { data: sessions } = await sb.from('meeting_attendance_sessions')
    .select('joined_at, left_at, duration_seconds')
    .eq('meeting_id', meeting.id).eq('member_id', memberId).order('joined_at');

  const rows = sessions || [];
  const closed = rows.filter(s => s.left_at);

  /* The UNION of the sessions, not their sum.
   *
   * Two devices, or a reconnect before the old session closed, made the same
   * minutes count twice — one member of a two-hour meeting was credited with
   * 7h 43m. mergedAttendanceSeconds() merges the overlaps, so time in the
   * meeting is counted once however many sessions it arrived in. */
  const total = mergedAttendanceSeconds(rows, {
    start: meeting.started_at,
    end: meeting.ended_at,
  });

  const { status, percentage } = attendanceStatusFor({
    totalSeconds: total,
    runSeconds: meetingRunSeconds(meeting),
    firstJoinedAt: rows[0]?.joined_at,
    startedAt: meeting.started_at,
    scheduledAt: meeting.scheduled_at,
  });

  await sb.from('meeting_attendance').upsert({
    meeting_id: meeting.id,
    member_id: memberId,
    first_joined_at: rows[0]?.joined_at || null,
    last_left_at: closed.length ? closed[closed.length - 1].left_at : null,
    total_duration_seconds: total,
    session_count: rows.length,
    attendance_percentage: percentage,
    attendance_status: status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'meeting_id,member_id' });
}
