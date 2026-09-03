'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';
import { Card } from '../ui';
import { exportAttendanceCsv, exportAttendancePdf } from './attendanceExport';
import {
  ATTENDANCE_TONE, STATUS_LABEL, STATUS_TONE, typeLabel, typeIcon,
  fmtDateTime, fmtDuration,
} from '@/lib/meetings';

const L = { deep: '#063D2B', green: '#0B6B4F', goldInk: '#7A5D10' };
const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

const TABS = [
  ['overview', 'Overview'], ['attendance', 'Attendance'], ['minutes', 'Minutes'],
  ['actions', 'Action Items'], ['documents', 'Documents'],
  ['recording', 'Recording'], ['chat', 'Chat History'],
];

/* Everything a meeting left behind, in one place.
 *
 * A LIGHT panel, like the applications dialog: attendance and minutes are read
 * carefully rather than glanced at, and this is the screen a secretary works
 * in for twenty minutes writing up a session.
 */
export default function MeetingRecord({ meeting, onBack, toast }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    aGet(`/api/admin/meetings/record?id=${meeting.id}`).then(r => setD(r?.ok ? r : null));
  }, [meeting.id]);
  useEffect(() => { load(); }, [load]);

  const post = async (body, key) => {
    setBusy(key || body.action);
    const r = await aPost('/api/admin/meetings/record', { meeting_id: meeting.id, ...body });
    setBusy('');
    toast?.(r.ok ? r.message : (r.message || 'Could not save.'), r.ok ? 'ok' : 'err');
    if (r.ok) load();
    return r;
  };

  if (!d) return (
    <Card><div className="py-12 text-center text-sm text-tnr-cream/40">Loading the record…</div></Card>
  );

  const m = d.meeting;
  const tone = STATUS_TONE[m.state] || STATUS_TONE.completed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-tnr-cream">
            <span className="mr-1.5">{typeIcon(m.meeting_type)}</span>{m.title}
          </h2>
          <p className="text-sm text-tnr-cream/50">
            {typeLabel(m.meeting_type)} · {fmtDateTime(m.scheduled_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
            style={{ background: tone.bg, color: tone.fg }}>{STATUS_LABEL[m.state]}</span>
          <button onClick={onBack} className="text-sm text-tnr-cream/60 hover:underline">
            ← All meetings
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold transition ${tab === k
              ? 'text-white' : 'border border-tnr-line text-tnr-cream/70 hover:bg-white/5'}`}
            style={tab === k ? { background: L.green } : undefined}>
            {label}
            {k === 'actions' && d.actions.length > 0 && <Count n={d.actions.length} on={tab === k} />}
            {k === 'documents' && d.documents.length > 0 && <Count n={d.documents.length} on={tab === k} />}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {tab === 'overview' && <Overview d={d} />}
        {tab === 'attendance' && <Attendance d={d} post={post} busy={busy} toast={toast} />}
        {tab === 'minutes' && <Minutes d={d} post={post} busy={busy} />}
        {tab === 'actions' && <Actions d={d} post={post} busy={busy} />}
        {tab === 'documents' && <Documents d={d} post={post} busy={busy} toast={toast} />}
        {tab === 'recording' && <Recording d={d} />}
        {tab === 'chat' && <ChatHistory d={d} />}
      </div>
    </div>
  );
}

const Count = ({ n, on }) => (
  <span className={`ml-1.5 text-[11px] ${on ? 'text-white/70' : 'text-tnr-cream/40'}`}>{n}</span>
);

/* ── Overview ────────────────────────────────────────────────────────────── */
function Overview({ d }) {
  const s = d.summary;
  const m = d.meeting;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Invited', s.invited], ['Attended', s.attended],
          ['Present', s.present], ['Partial', s.partial],
          ['Absent', s.absent], ['Average', `${s.average_percentage}%`],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl border border-gray-100 px-3 py-2.5">
            <div className="text-xl font-black" style={{ color: L.deep }}>{v}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <H>Details</H>
          <Row k="Scheduled" v={fmtDateTime(m.scheduled_at)} />
          <Row k="Started" v={m.started_at ? fmtDateTime(m.started_at) : 'Never started'} />
          <Row k="Ended" v={m.ended_at ? fmtDateTime(m.ended_at) : '—'} />
          {/* The DENOMINATOR for every percentage on this screen. Stated, not
              implied — a chair querying "74%" needs to know what it is 74% of. */}
          <Row k="Actual duration" v={fmtDuration(s.run_seconds)} />
          <Row k="Scheduled for" v={`${m.duration_minutes} minutes`} />
          <Row k="Host" v={d.host?.full_name || '—'} />
          {!!d.coHosts?.length && <Row k="Co-hosts" v={d.coHosts.map(c => c.full_name).join(', ')} />}
        </section>

        <section>
          <H>Record</H>
          <Row k="Minutes" v={d.minutes
            ? (d.minutes.status === 'published' ? 'Published' : 'Draft') : 'Not written'} />
          <Row k="Action items" v={`${d.actions.length} (${d.actions.filter(a => a.status === 'completed').length} done)`} />
          <Row k="Documents" v={String(d.documents.length)} />
          <Row k="Recordings" v={String(d.recordings.length)} />
          <Row k="Chat messages" v={String(d.chat.length)} />
        </section>
      </div>

      {m.agenda && (
        <section>
          <H>Agenda</H>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{m.agenda}</p>
        </section>
      )}
    </div>
  );
}

/* ── Attendance ──────────────────────────────────────────────────────────── */
function Attendance({ d, post, busy, toast }) {
  const [open, setOpen] = useState(null);   // member id whose sessions are shown
  const [exporting, setExporting] = useState('');

  const run = async (kind) => {
    setExporting(kind);
    try {
      const fn = kind === 'pdf' ? exportAttendancePdf : exportAttendanceCsv;
      await fn(d.meeting, d.attendance, d.summary);
      toast?.(`${d.attendance.length} row(s) exported.`, 'ok');
    } catch (e) { toast?.(e?.message || 'Could not build the file.', 'err'); }
    finally { setExporting(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-gray-500">
          Percentages are of the <strong>{fmtDuration(d.summary.run_seconds)}</strong> the meeting
          actually ran. Present ≥ 75%; absent means never connected.
        </p>
        <div className="flex gap-2">
          <button onClick={() => run('csv')} disabled={!!exporting}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700
              hover:bg-gray-50 disabled:opacity-40">
            {exporting === 'csv' ? 'Building…' : 'Download CSV'}
          </button>
          <button onClick={() => run('pdf')} disabled={!!exporting}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700
              hover:bg-gray-50 disabled:opacity-40">
            {exporting === 'pdf' ? 'Building…' : 'Download PDF'}
          </button>
          {/* The sessions are the truth; this table is a cache of them. */}
          <button onClick={() => post({ action: 'recompute_attendance' })} disabled={!!busy}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700
              hover:bg-gray-50 disabled:opacity-40"
            title="Rebuild every row from the join/leave sessions">
            {busy === 'recompute_attendance' ? 'Working…' : 'Recalculate'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-500">
              {['Member', 'Membership ID', 'First joined', 'Last left', 'Duration', 'Sessions', '%', 'Status', ''].map(h => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.attendance.map(r => {
              const t = ATTENDANCE_TONE[r.attendance_status] || ATTENDANCE_TONE.absent;
              const shown = open === r.member_id;
              return (
                <>
                  <tr key={r.member_id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-gray-800">
                      {r.member?.full_name || '—'}
                      {r.role !== 'participant' && (
                        <span className="ml-1.5 text-[10px] font-black uppercase" style={{ color: L.goldInk }}>
                          {r.role.replace('_', '-')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{r.member?.membership_id || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">
                      {r.first_joined_at ? fmtDateTime(r.first_joined_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">
                      {r.last_left_at ? fmtDateTime(r.last_left_at) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-gray-800">
                      {r.total_duration_seconds ? fmtDuration(r.total_duration_seconds) : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-gray-600">
                      {r.session_count > 1 ? (
                        <button onClick={() => setOpen(shown ? null : r.member_id)}
                          className="font-semibold underline" style={{ color: L.green }}>
                          {r.session_count}
                        </button>
                      ) : (r.session_count || '—')}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums" style={{ color: t.fg }}>
                      {r.attendance_percentage}%
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                        style={{ background: t.bg, color: t.fg }}>{r.attendance_status}</span>
                    </td>
                    <td className="px-3 py-2.5" />
                  </tr>

                  {/* Why the total is what it is. Three drops on mobile data
                      reads very differently from arriving an hour late, and
                      the roll-up alone cannot tell them apart. */}
                  {shown && (
                    <tr key={`${r.member_id}-s`} className="border-b border-gray-100 bg-gray-50">
                      <td colSpan={9} className="px-3 py-2.5">
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Connections
                        </p>
                        <ul className="space-y-1">
                          {r.sessions.map(s => (
                            <li key={s.id} className="text-[12px] text-gray-600">
                              {fmtDateTime(s.joined_at)} → {s.left_at ? fmtDateTime(s.left_at) : 'still open'}
                              <span className="ml-2 font-semibold text-gray-800">
                                {s.duration_seconds != null ? fmtDuration(s.duration_seconds) : ''}
                              </span>
                              {s.disconnect_reason && s.disconnect_reason !== 'left' && (
                                <span className="ml-2 text-gray-400">({s.disconnect_reason.replace(/_/g, ' ')})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Minutes ─────────────────────────────────────────────────────────────── */
function Minutes({ d, post, busy }) {
  const [f, setF] = useState({ summary: '', key_discussion: '', decisions: '' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setF({
      summary: d.minutes?.summary || '',
      key_discussion: d.minutes?.key_discussion || '',
      decisions: d.minutes?.decisions || '',
    });
    setReady(true);
  }, [d.minutes]);

  const save = (status) => post({
    action: 'save_minutes', ...f, status,
  }, status === 'published' ? 'publish' : 'draft');

  if (!ready) return null;
  const published = d.minutes?.status === 'published';

  return (
    <div className="space-y-4">
      {published && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-900">
          <strong>Published</strong> {d.minutes.published_at ? `on ${fmtDateTime(d.minutes.published_at)}` : ''} —
          this is the version the committee stands behind. Editing and publishing again replaces it.
        </p>
      )}

      {[
        ['summary', 'Summary', 4, 'What the meeting was for and what came out of it.'],
        ['key_discussion', 'Key discussion', 6, 'The substance of the debate — the points made, by whom.'],
        ['decisions', 'Decisions', 4, 'What was resolved. One decision per line.'],
      ].map(([k, label, rows, hint]) => (
        <label key={k} className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
          <textarea rows={rows} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}
            className={input} placeholder={hint} />
        </label>
      ))}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <button onClick={() => save('draft')} disabled={!!busy}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700
            hover:bg-gray-50 disabled:opacity-40">
          {busy === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button onClick={() => save('published')} disabled={!!busy}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: L.green }}>
          {busy === 'publish' ? 'Publishing…' : published ? 'Republish' : 'Publish minutes'}
        </button>
        {/* Draft and published are different states because minutes are a
            record of what a body decided: it matters whether someone is still
            editing them or the committee has adopted them. */}
        <span className="self-center text-[12px] text-gray-500">
          Drafts are visible only here.
        </span>
      </div>
    </div>
  );
}

/* ── Action items ────────────────────────────────────────────────────────── */
function Actions({ d, post, busy }) {
  const [f, setF] = useState({ title: '', description: '', assigned_to: '', deadline: '' });

  const add = async () => {
    const r = await post({ action: 'save_action', ...f }, 'add');
    if (r?.ok) setF({ title: '', description: '', assigned_to: '', deadline: '' });
  };

  const people = d.attendance.map(a => a.member).filter(Boolean);
  const overdue = (a) => a.deadline && a.status !== 'completed' && new Date(a.deadline) < new Date();

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-gray-200 p-3">
        <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })}
          className={input} placeholder="What needs doing?" />
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={f.assigned_to} onChange={e => setF({ ...f, assigned_to: e.target.value })}
            className={input}>
            <option value="">Assign to…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })}
            className={input} />
        </div>
        <button onClick={add} disabled={!f.title.trim() || !!busy}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: L.green }}>
          {busy === 'add' ? 'Adding…' : 'Add action item'}
        </button>
      </div>

      {!d.actions.length && (
        <p className="py-6 text-center text-sm text-gray-400">
          No action items yet. A decision with nobody's name on it rarely happens.
        </p>
      )}

      <ul className="space-y-2">
        {d.actions.map(a => (
          <li key={a.id} className="rounded-xl border p-3"
            style={{ borderColor: overdue(a) ? '#FCA5A5' : '#E5E7EB' }}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className={`text-[14px] font-semibold ${a.status === 'completed'
                  ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{a.title}</div>
                <div className="mt-0.5 text-[12px] text-gray-500">
                  {a.assignee ? a.assignee.full_name : 'Unassigned'}
                  {a.deadline && (
                    <span className={overdue(a) ? 'ml-2 font-bold text-red-600' : 'ml-2'}>
                      due {new Date(a.deadline).toLocaleDateString('en-GB',
                        { day: '2-digit', month: 'short', year: 'numeric' })}
                      {overdue(a) ? ' — overdue' : ''}
                    </span>
                  )}
                </div>
              </div>
              <select value={a.status} disabled={!!busy}
                onChange={e => post({
                  action: 'save_action', id: a.id, title: a.title, description: a.description,
                  assigned_to: a.assigned_to, deadline: a.deadline, status: e.target.value,
                }, a.id)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <button onClick={() => confirm(`Remove "${a.title}"?`) && post({ action: 'delete_action', id: a.id }, a.id)}
                disabled={!!busy}
                className="rounded-lg border border-red-200 px-2 py-1 text-[12px] font-semibold text-red-600
                  hover:bg-red-50 disabled:opacity-40">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Documents ───────────────────────────────────────────────────────────── */
function Documents({ d, post, busy, toast }) {
  const [f, setF] = useState({ title: '', category: 'attachment' });
  const [file, setFile] = useState(null);

  const upload = async () => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024)
      return toast?.('Files must be under 15 MB. Share larger files by link.', 'err');

    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result); fr.onerror = rej;
      fr.readAsDataURL(file);
    });

    const r = await post({
      action: 'add_document',
      title: f.title.trim() || file.name,
      category: f.category,
      file_type: file.type || null,
      file_data: dataUrl,
    }, 'upload');
    if (r?.ok) { setF({ title: '', category: 'attachment' }); setFile(null); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-gray-200 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })}
            className={input} placeholder="Title (defaults to the file name)" />
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}
            className={input}>
            {['agenda', 'presentation', 'minutes', 'report', 'attachment'].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
            file:bg-[#0B6B4F] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white" />
        <button onClick={upload} disabled={!file || !!busy}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: L.green }}>
          {busy === 'upload' ? 'Uploading…' : 'Upload document'}
        </button>
      </div>

      {!d.documents.length && (
        <p className="py-6 text-center text-sm text-gray-400">No documents attached to this meeting.</p>
      )}

      <ul className="space-y-2">
        {d.documents.map(doc => (
          <li key={doc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-lg"
              style={{ background: 'rgba(11,107,79,.08)' }}>📎</span>
            <div className="min-w-0 flex-1">
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="block truncate text-[14px] font-semibold hover:underline" style={{ color: L.deep }}>
                {doc.title}
              </a>
              <div className="text-[11.5px] text-gray-500">
                {doc.category} · {fmtBytes(doc.file_size)} · {fmtDateTime(doc.created_at)}
              </div>
            </div>
            <button onClick={() => confirm(`Remove "${doc.title}"?`) && post({ action: 'delete_document', id: doc.id }, doc.id)}
              disabled={!!busy}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] font-semibold text-red-600
                hover:bg-red-50 disabled:opacity-40">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Recording ───────────────────────────────────────────────────────────── */
function Recording({ d }) {
  if (!d.recordings.length) return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-500">
        {d.meeting.recording_enabled
          ? 'Recording was allowed for this meeting, but the host never started one.'
          : 'Recording was not enabled for this meeting.'}
      </p>
      <p className="mx-auto mt-2 max-w-md text-[12.5px] text-gray-400">
        A host starts and stops recording from inside the room. Everyone present is shown an
        indicator for as long as it runs.
      </p>
    </div>
  );

  return (
    <ul className="space-y-2">
      {d.recordings.map(r => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-lg"
            style={{ background: 'rgba(220,38,38,.08)' }}>🎥</span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold" style={{ color: L.deep }}>
              {r.file_name || 'Meeting recording'}
            </div>
            <div className="text-[11.5px] text-gray-500">
              {fmtDateTime(r.started_at || r.created_at)}
              {r.duration_seconds ? ` · ${fmtDuration(r.duration_seconds)}` : ''}
              {r.file_size ? ` · ${fmtBytes(r.file_size)}` : ''}
              {r.created_by ? ` · started by ${r.created_by}` : ''}
            </div>
          </div>
          {r.status === 'ready' && r.file_url ? (
            <a href={r.file_url} target="_blank" rel="noopener noreferrer"
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-white" style={{ background: L.green }}>
              Open
            </a>
          ) : (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.status === 'failed'
              ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
              {/* Processing is the normal state for several minutes after a
                  meeting ends — the media server is still encoding. */}
              {r.status === 'failed' ? 'Failed' : 'Processing…'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── Chat history ────────────────────────────────────────────────────────── */
function ChatHistory({ d }) {
  if (!d.chat.length) return (
    <p className="py-8 text-center text-sm text-gray-400">Nothing was said in the chat.</p>
  );
  return (
    <ul className="space-y-2">
      {d.chat.map(c => (
        <li key={c.id} className="border-b border-gray-100 pb-2 last:border-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-gray-800">
              {c.sender?.full_name || 'Member'}
            </span>
            <span className="text-[11px] text-gray-400">{fmtDateTime(c.created_at)}</span>
          </div>
          {/* Rendered as text, never as markup. */}
          <p className="whitespace-pre-wrap text-[13px] text-gray-700">{c.message}</p>
        </li>
      ))}
    </ul>
  );
}

/* ── Bits ────────────────────────────────────────────────────────────────── */
const H = ({ children }) => (
  <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">{children}</h3>
);
const Row = ({ k, v }) => (
  <div className="flex justify-between gap-3 border-b border-gray-50 py-1.5 text-[13px] last:border-0">
    <span className="text-gray-500">{k}</span>
    <span className="text-right font-semibold text-gray-800">{v}</span>
  </div>
);
function fmtBytes(n) {
  const b = Number(n || 0);
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
