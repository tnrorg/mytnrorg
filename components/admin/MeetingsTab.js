'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPost, aDel } from './adminApi';
import { Card } from './ui';
import MeetingEditor from './meetings/MeetingEditor';
import MeetingRecord from './meetings/MeetingRecord';
import {
  MEETING_TYPES, STATUS_LABEL, STATUS_TONE, typeLabel, typeIcon,
  fmtDateTime, relativeTime,
} from '@/lib/meetings';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';
const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };

/* TNR Meetings — admin.
 *
 * Reached under the `meetings` permission area. This screen shows attendance
 * counts and invitation lists for Advisory Council and CEC sessions, which is
 * why it is its own area rather than part of Website Content.
 */
export default function MeetingsTab({ toast }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);   // meeting object or {} for new
  const [record, setRecord] = useState(null);     // meeting whose record is open
  const [busyId, setBusyId] = useState(null);
  const [progress, setProgress] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (type) p.set('type', type);
    aGet(`/api/admin/meetings?${p}`).then(r => setD(r?.ok ? r : { meetings: [], stats: {} }));
  }, [status, type]);

  useEffect(() => { load(); }, [load]);

  /* Email anyone on the list who has not been emailed yet.
   *
   * Safe to press repeatedly: the server skips members already reached, so
   * this is both "finish an interrupted send" and "catch the people invited
   * after the meeting was created". */
  async function emailInvites(m, kind = 'created', resend = false) {
    setBusyId(m.id);
    setProgress('Sending…');

    /* Each round returns only ITS OWN tally, so the totals are accumulated
     * here. Reporting the last round's numbers made a send of 60 people
     * announce "10 invitations emailed." */
    let sent = 0, failed = 0, noEmail = 0, offset = 0, warning = null, detail = null;
    let lastRemaining = Infinity;
    let guard = 0;
    let ended = 'done';

    for (;;) {
      /* A hard ceiling on rounds. Nothing should reach it — the server now
       * stops itself when a round makes no progress — but a spinner that can
       * never stop is worse than one that gives up and says so. */
      if (guard++ > 200) { ended = 'runaway'; break; }

      const r = await aPost('/api/admin/meetings', {
        action: 'email_invites', id: m.id, kind, resend, offset,
      });

      if (!r?.ok) { ended = 'error'; detail = [r?.message, r?.detail].filter(Boolean).join(' '); break; }

      sent += r.sent || 0;
      failed += r.failed || 0;
      noEmail += r.no_email || 0;
      warning = warning || r.warning || null;
      detail = r.detail || detail;

      if (r.done) break;

      /* The list must be getting shorter. If it is not, asking again would
       * send the same batch for ever. */
      if (!(r.remaining < lastRemaining)) { ended = 'stalled'; break; }
      lastRemaining = r.remaining;

      setProgress(`Sent ${sent}${r.total ? ` of ${r.total}` : ''}…`);
      offset = r.next_offset;
    }

    setBusyId(null);
    setProgress('');

    if (ended === 'error') {
      return toast?.(detail || 'Could not email invitations.', 'err');
    }

    const tally = [
      sent ? `${sent} emailed` : null,
      failed ? `${failed} failed` : null,
      noEmail ? `${noEmail} have no email address` : null,
    ].filter(Boolean).join(', ') || 'nothing to send';

    if (ended === 'stalled' || ended === 'runaway') {
      return toast?.(`Stopped after ${tally}. ${detail || 'The remaining members could not be reached.'}`, 'err');
    }
    toast?.([`Invitations: ${tally}.`, detail, warning].filter(Boolean).join(' '), sent ? 'ok' : 'err');
  }

  async function cancel(m) {
    const reason = prompt(
      `Cancel "${m.title}"?\n\nEveryone invited will be notified. Give a short reason:`,
      '');
    if (reason === null) return;               // dismissed, not confirmed
    setBusyId(m.id);
    const r = await aPost('/api/admin/meetings', { action: 'cancel', id: m.id, reason });
    if (!r.ok) {
      setBusyId(null);
      return toast?.(r.message || 'Could not cancel.', 'err');
    }
    toast?.(r.message, 'ok');

    /* Email the cancellation too, with resend forced.
     *
     * Everyone here was already emailed the invitation, so the "skip anyone
     * already reached" rule would silently send nothing — which is the one
     * case where it is exactly wrong. A member whose calendar still says the
     * meeting is on will turn up to an empty room. The .ics carries METHOD:
     * CANCEL, so the entry is removed rather than left sitting there. */
    await emailInvites(m, 'cancelled', true);

    load();
  }

  /* Delete, in two steps when there is a record to lose.
   *
   * The first request comes back refusing and saying exactly what is attached
   * — 4 attendance rows, minutes, 2 documents. The confirmation then names
   * those numbers rather than asking "are you sure?" about an abstraction.
   * Only that second, informed request carries force. */
  async function remove(m) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    setBusyId(m.id);

    let r = await aDel(`/api/admin/meetings?id=${m.id}`);

    if (!r.ok && r.needs_force) {
      const c = r.counts || {};
      const lost = [
        c.attendance && `${c.attendance} attendance record(s)`,
        c.sessions && `${c.sessions} join/leave session(s)`,
        c.minutes && 'the meeting minutes',
        c.documents && `${c.documents} document(s)`,
        c.action_items && `${c.action_items} action item(s)`,
      ].filter(Boolean);

      const go = confirm(
        `"${m.title}" has a record attached.\n\n`
        + `Deleting it will also erase:\n  • ${lost.join('\n  • ')}\n\n`
        + `This cannot be undone. Delete anyway?`
      );
      if (!go) { setBusyId(null); return; }
      r = await aDel(`/api/admin/meetings?id=${m.id}&force=1`);
    }

    setBusyId(null);
    toast?.(r.ok ? r.message : (r.message || 'Could not delete.'), r.ok ? 'ok' : 'err');
    if (r.ok) load();
  }

  const rows = (d?.meetings || []).filter(m => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [m.title, m.host?.full_name, m.host?.membership_id]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  const S = d?.stats || {};

  /* The record page replaces the list rather than opening over it. Attendance,
   * minutes and documents are a workspace, not a dialog — a secretary writing
   * up a session is in there for twenty minutes. */
  if (record) return (
    <MeetingRecord meeting={record} toast={toast}
      onBack={() => { setRecord(null); load(); }} />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tnr-cream">TNR Meetings</h2>
          <p className="text-sm text-tnr-cream/50">Schedule sessions, invite members, track attendance.</p>
        </div>
        <button onClick={() => setEditing({})}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: LIGHT.green }}>
          + Schedule meeting
        </button>
      </div>

      {/* ── Dashboard cards. Each one filters the table. ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ['Total', S.total, null],
          ['Upcoming', S.scheduled, 'scheduled'],
          ['Live', S.live, 'live'],
          ['Completed', S.completed, 'completed'],
          ['Cancelled', S.cancelled, 'cancelled'],
        ].map(([label, n, key]) => (
          <button key={label} onClick={() => setStatus(key === status ? '' : (key || ''))}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${status && status === key
              ? 'border-tnr-gold/50 bg-tnr-gold/10' : 'border-tnr-line hover:bg-white/5'}`}>
            <div className="text-xl font-black text-tnr-cream">{n ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or host…" className={`${input} min-w-[200px] flex-1`} />
        <select value={type} onChange={e => setType(e.target.value)}
          className={`${input} w-auto`}>
          <option value="">All types</option>
          {MEETING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {!rows.length && (
        <Card><div className="py-10 text-center text-sm text-tnr-cream/40">
          {d ? 'No meetings match.' : 'Loading…'}
        </div></Card>
      )}

      {/* ── Table ── */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-tnr-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tnr-line text-left text-[10px] uppercase tracking-wider text-tnr-cream/40">
                {['Title', 'Type', 'Host', 'When', 'Invited', 'Attended', 'Status', ''].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(m => {
                const tone = STATUS_TONE[m.state] || STATUS_TONE.scheduled;
                const past = m.state === 'completed' || m.state === 'cancelled';
                return (
                  <tr key={m.id} className="border-b border-tnr-line/50 hover:bg-white/5">
                    <td className="px-3 py-2.5 font-semibold text-tnr-cream">
                      <span className="mr-1.5">{typeIcon(m.meeting_type)}</span>{m.title}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-tnr-cream/60">
                      {typeLabel(m.meeting_type)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-tnr-cream/60">
                      {m.host?.full_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-tnr-cream/60">
                      {fmtDateTime(m.scheduled_at)}
                      <span className="ml-1.5 text-[11px] text-tnr-cream/40">
                        {relativeTime(m.scheduled_at)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-tnr-cream/80">{m.participant_count}</td>
                    {/* Blank rather than 0 for a meeting that has not run —
                        "0 attended" reads as a failure, not as "not yet". */}
                    <td className="px-3 py-2.5 tabular-nums text-tnr-cream/80">
                      {past ? m.joined_count : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                        style={{ background: tone.bg, color: tone.fg }}>
                        {STATUS_LABEL[m.state]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex gap-2.5 text-xs">
                        <button onClick={() => setRecord(m)}
                          className="text-tnr-goldLight hover:underline">Record</button>
                        {m.state === 'scheduled' && (
                          <button onClick={() => emailInvites(m)} disabled={busyId === m.id}
                            className="text-tnr-cream/70 hover:underline disabled:opacity-40"
                            title="Email anyone not yet sent an invitation">
                            {busyId === m.id ? (progress || 'Emailing…') : 'Email invites'}
                          </button>
                        )}
                        <button onClick={() => setEditing(m)} disabled={busyId === m.id}
                          className="text-tnr-cream/70 hover:underline disabled:opacity-40">Edit</button>
                        {m.state === 'scheduled' && (
                          <button onClick={() => cancel(m)} disabled={busyId === m.id}
                            className="text-amber-300 hover:underline disabled:opacity-40">Cancel</button>
                        )}
                        {/* Available for completed meetings too — a finished
                            test still has to be clearable. What it would
                            erase is named in the confirmation. Live meetings
                            are the one exception; people are in the room. */}
                        {m.state !== 'live' && (
                          <button onClick={() => remove(m)} disabled={busyId === m.id}
                            className="text-red-300 hover:underline disabled:opacity-40">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}



      {editing && (
        <MeetingEditor meeting={editing.id ? editing : null} toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
