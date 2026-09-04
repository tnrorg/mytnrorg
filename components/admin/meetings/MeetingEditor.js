'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';
import AudiencePicker from './AudiencePicker';
import {
  MEETING_TYPES, toLocalInput, fromLocalInput, DURATION_MIN, DURATION_MAX,
} from '@/lib/meetings';

const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };
const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

/* Schedule or edit a meeting.
 *
 * A LIGHT dialog, matching the applications dialog: this form carries a
 * meeting's agenda and its invitation list, and is read carefully rather than
 * glanced at.
 *
 * The date/time field is a native picker and its value is converted with
 * fromLocalInput before it leaves the browser. A datetime-local input yields a
 * naive string with no zone; sending that straight to a timestamptz column is
 * exactly what made news posts invisible for five hours, and would put a
 * meeting scheduled for 8pm into the following morning.
 */
const BLANK = {
  title: '', description: '', agenda: '', meeting_type: 'general',
  scheduled_at: '', duration_minutes: 60,
  host_id: '', co_host_ids: [],
  waiting_room_enabled: true, recording_enabled: false,
  chat_enabled: true, screen_share_enabled: true, join_before_host: false,
  password: '',
};

export default function MeetingEditor({ meeting, onClose, onSaved, toast }) {
  const [f, setF] = useState(BLANK);
  const [audience, setAudience] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [hostQ, setHostQ] = useState('');
  const [hostFound, setHostFound] = useState([]);
  const [host, setHost] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [emailInvites, setEmailInvites] = useState(true);
  const [sending, setSending] = useState(null);

  /* An EDIT that moved the time is a reschedule, not a fresh invitation —
   * different subject, and an .ics that replaces the calendar entry rather
   * than adding a second one. */
  const b_kind = meeting?.id ? 'rescheduled' : 'created';

  const editing = !!meeting?.id;

  useEffect(() => {
    if (!editing) return;
    aGet(`/api/admin/meetings?id=${meeting.id}`).then(r => {
      if (!r?.ok) return;
      const m = r.meeting;
      setF({
        ...BLANK, ...m,
        scheduled_at: toLocalInput(m.scheduled_at),
        // Undefined, not '': the server treats an absent password as "leave it
        // alone" and an empty string as "remove it". Editing the agenda must
        // not silently clear a passcode nobody meant to touch.
        password: undefined,
      });
      setHost(r.host || null);
    });
  }, [editing, meeting?.id]);

  // Host search — the same debounce as the participant picker.
  useEffect(() => {
    const term = hostQ.trim();
    if (term.length < 2) { setHostFound([]); return; }
    const t = setTimeout(() => {
      aGet(`/api/admin/meetings/audience?q=${encodeURIComponent(term)}`)
        .then(r => setHostFound(r?.ok ? r.members : []));
    }, 300);
    return () => clearTimeout(t);
  }, [hostQ]);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  async function save() {
    setErrors({});
    setBusy(true);
    const r = await aPost('/api/admin/meetings', {
      ...(editing ? { id: meeting.id } : {}),
      ...f,
      scheduled_at: fromLocalInput(f.scheduled_at),
      duration_minutes: Number(f.duration_minutes) || 60,
      audience, member_ids: memberIds,
    });
    setBusy(false);

    if (!r.ok) {
      if (r.errors) setErrors(r.errors);
      return toast?.(r.message || 'Could not save. Check the highlighted fields.', 'err');
    }
    toast?.(r.message, 'ok');

    /* Then email everyone, in batches.
     *
     * The meeting and the portal notifications are already saved by this
     * point, so a browser closed mid-send loses only the remaining emails —
     * and the server skips anyone already reached, so pressing Resend later
     * picks up exactly where this stopped rather than starting again. */
    const meetingId = r.meeting?.id || meeting?.id;
    if (meetingId && emailInvites) {
      setSending({ sent: 0, total: 0 });
      let offset = 0;
      for (;;) {
        const e = await aPost('/api/admin/meetings', {
          action: 'email_invites', id: meetingId,
          kind: b_kind, offset,
        });
        if (!e?.ok) { toast?.([e?.message || 'Could not email invitations.', e?.detail]
        .filter(Boolean).join(' '), 'err'); break; }
        setSending({ sent: e.next_offset || 0, total: e.total || 0 });
        if (e.done) {
        toast?.([e.message, e.warning].filter(Boolean).join(' '),
          e.sent ? 'ok' : 'err');
        break;
      }
        offset = e.next_offset;
      }
      setSending(null);
    }

    onSaved?.();
  }

  const Err = ({ k }) => errors[k]
    ? <p className="mt-1 text-[12px] font-semibold text-red-600">{errors[k]}</p> : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="my-8 w-full max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold" style={{ color: LIGHT.deep }}>
            {editing ? 'Edit meeting' : 'Schedule a meeting'}
          </h3>
          <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {/* ── What ── */}
        <section className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Title *</span>
            <input value={f.title} onChange={e => set('title', e.target.value)} className={input}
              placeholder="Advisory Council — September Session" />
            <Err k="title" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Meeting type *</span>
            <select value={f.meeting_type} onChange={e => set('meeting_type', e.target.value)} className={input}>
              {MEETING_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>
            <Err k="meeting_type" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Agenda</span>
            <textarea rows={4} value={f.agenda || ''} onChange={e => set('agenda', e.target.value)}
              className={input} placeholder={'1. Approval of previous minutes\n2. Programme review'} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Description</span>
            <textarea rows={2} value={f.description || ''} onChange={e => set('description', e.target.value)}
              className={input} />
          </label>
        </section>

        {/* ── When ── */}
        <section className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Date &amp; time *</span>
            <input type="datetime-local" value={f.scheduled_at}
              onChange={e => set('scheduled_at', e.target.value)} className={input} />
            <Err k="scheduled_at" />
            {/* Written out in full, in the admin's own timezone, so a wrong
                month is caught before 293 people are told about it. */}
            {f.scheduled_at && (
              <p className="mt-1 text-[12px] text-gray-500">
                {new Date(f.scheduled_at).toLocaleString(undefined, {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Duration (minutes) *</span>
            <input type="number" min={DURATION_MIN} max={DURATION_MAX} step={5}
              value={f.duration_minutes}
              onChange={e => set('duration_minutes', e.target.value)} className={input} />
            <Err k="duration_minutes" />
          </label>
        </section>

        {/* ── Host ── */}
        <section>
          <span className="mb-1 block text-xs text-gray-500">Host *</span>
          {host ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-gray-800">{host.full_name}</span>
                <span className="block font-mono text-[11px] text-gray-400">{host.membership_id}</span>
              </span>
              <button type="button" onClick={() => { setHost(null); set('host_id', ''); }}
                className="text-[12px] text-gray-400 hover:text-red-600">Change</button>
            </div>
          ) : (
            <>
              <input value={hostQ} onChange={e => setHostQ(e.target.value)} className={input}
                placeholder="Search for the host by name or membership ID…" />
              {!!hostFound.length && (
                <ul className="mt-2 max-h-44 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
                  {hostFound.map(m => (
                    <li key={m.id}>
                      <button type="button"
                        onClick={() => { setHost(m); set('host_id', m.id); setHostQ(''); setHostFound([]); }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50">
                        <span className="block text-[13px] font-semibold text-gray-800">{m.full_name}</span>
                        <span className="block font-mono text-[11px] text-gray-400">{m.membership_id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <Err k="host_id" />
        </section>

        {/* ── Who ── */}
        <section className="border-t border-gray-100 pt-4">
          <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">Participants</h4>
          {editing && (
            <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
              People already invited stay invited. Anything selected here is <strong>added</strong> to
              the list — nobody is removed by editing.
            </p>
          )}
          <AudiencePicker
            audience={audience} setAudience={setAudience}
            memberIds={memberIds} setMemberIds={setMemberIds} toast={toast} />
        </section>

        {/* ── How ── */}
        <section className="space-y-2 border-t border-gray-100 pt-4">
          <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Meeting options</h4>
          {[
            ['waiting_room_enabled', 'Waiting room', 'The host admits people one by one.'],
            ['chat_enabled', 'Chat', 'Participants can send messages during the meeting.'],
            ['screen_share_enabled', 'Screen sharing', 'Off means only the host may share.'],
            ['join_before_host', 'Allow joining before the host', 'People can enter the room early.'],
            ['recording_enabled', 'Allow recording', 'The host still has to start it, and everyone is shown an indicator.'],
          ].map(([k, label, hint]) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-50">
              <input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#0B6B4F]" />
              <span>
                <span className="block text-[13px] font-semibold text-gray-800">{label}</span>
                <span className="block text-[11.5px] text-gray-500">{hint}</span>
              </span>
            </label>
          ))}

          <label className="block pt-1">
            <span className="mb-1 block text-xs text-gray-500">Passcode (optional)</span>
            <input type="text" value={f.password ?? ''} onChange={e => set('password', e.target.value)}
              className={input}
              placeholder={editing ? 'Leave blank to keep the current passcode' : 'No passcode'} />
            <span className="mt-1 block text-[11.5px] text-gray-500">
              Stored hashed and never shown again — note it down before saving.
            </span>
          </label>
        </section>

        {/* Email is opt-out rather than opt-in: an invitation nobody was
            told about is the failure mode that matters, and the portal bell
            alone does not reach members who rarely sign in. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5">
          <input type="checkbox" checked={emailInvites} onChange={e => setEmailInvites(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0B6B4F]" />
          <span>
            <span className="block text-[13px] font-semibold text-gray-800">
              Email the invitation as well
            </span>
            <span className="block text-[11.5px] text-gray-500">
              Sends every invited member an email with a calendar attachment they can add in one
              tap. Portal notifications are sent either way.
            </span>
          </span>
        </label>

        {sending && (
          <div className="rounded-xl px-3 py-2.5 text-[12.5px]"
            style={{ background: 'rgba(11,107,79,.07)', color: LIGHT.deep }}>
            Emailing invitations… <strong>{sending.sent}</strong>
            {sending.total ? ` of ${sending.total}` : ''}. Keep this open until it finishes.
          </div>
        )}

        <div className="flex gap-2 border-t border-gray-200 pt-4">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={save} disabled={busy}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: LIGHT.green }}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule & invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
