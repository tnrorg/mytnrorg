'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import Avatar from '@/components/ui/Avatar';
import { mGet, mPost } from '@/components/member/memberApi';
import { FOLLOWUP_STATUSES, followupLabel, REQUEST_KINDS } from '@/lib/university/scope';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227', muted: '#647169' };

/* ── University Ambassador portal ────────────────────────────────────────────
 *
 * Everything on this page is what the server chose to send. Search, filters,
 * sorting and paging are all requests — the page never holds a list of
 * members wider than the page it is showing, so there is nothing in the
 * browser to filter around. Access is decided in lib/university/access.js.
 */

const TABS = [
  ['overview', 'Overview'],
  ['members', 'Members'],
  ['announce', 'Announcements'],
  ['requests', 'Requests'],
];

const FU_TONE = {
  none: 'bg-gray-100 text-gray-600',
  needs_followup: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  contacted: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
  resolved: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const monthLabel = (k) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function Pill({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${FU_TONE[status] || FU_TONE.none}`}>
      {followupLabel(status)}
    </span>
  );
}

function Notice({ tone = 'info', children }) {
  const cls = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-gray-200 bg-white text-gray-700';
  return <div className={`rounded-2xl border p-4 text-[14px] leading-relaxed ${cls}`}>{children}</div>;
}

// ── Overview ────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-[28px] font-black leading-none" style={{ color: accent || C.deep }}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-gray-500">{hint}</p>}
    </div>
  );
}

function Trend({ data }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[13px] font-bold" style={{ color: C.deep }}>New members, last 12 months</p>
      <div className="mt-4 flex h-36 items-end gap-1.5" role="img"
        aria-label={`Monthly registrations: ${data.map(d => `${monthLabel(d.key)} ${d.count}`).join(', ')}`}>
        {data.map(d => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-500">{d.count || ''}</span>
            <div className="w-full rounded-t-md transition-all duration-500"
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%`, background: d.count ? C.green : '#E5E7EB' }} />
            <span className="text-[10px] text-gray-400">{monthLabel(d.key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview({ data }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        <Skeleton className="col-span-2 h-48 lg:col-span-5" />
      </div>
    );
  }
  const s = data.stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Members" value={s.total} hint="Approved TNR members" />
        <StatCard label="Current students" value={s.students} hint="Position: Student" />
        <StatCard label="Not studying" value={s.not_studying} hint="Alumni, staff and others" />
        <StatCard label="New" value={s.new_30d} hint="Joined in the last 30 days" accent={C.green} />
        <StatCard label="Follow-up" value={s.needs_followup} hint="Marked as needing follow-up" accent="#B45309" />
      </div>
      <Trend data={data.trend} />
      <p className="text-[12px] leading-relaxed text-gray-500">
        Members appear here once their membership is approved and the university they gave matches
        this one. Anyone whose university could not be matched is listed for the TNR administration
        to resolve — they will appear here as soon as it is.
        {data.campusScoped && ' You are assigned to specific campuses, so only members placed on those campuses are shown.'}
      </p>
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

function MemberDrawer({ u, id, onClose, onChanged, onRequest }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setD(null); setErr('');
    mGet(`/api/member/university/members/${id}?u=${encodeURIComponent(u)}`).then(r => {
      if (r?.ok) setD(r); else setErr(r?.message || 'Could not load this member.');
    });
  }, [u, id]);
  useEffect(() => { load(); }, [load]);

  // Close on Escape.
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function setFollowup(status) {
    setBusy(true);
    const r = await mPost(`/api/member/university/members/${id}`, { u, action: 'followup', status });
    setBusy(false);
    if (r?.ok) { setD(x => ({ ...x, member: { ...x.member, followup: status } })); onChanged(); }
    else setErr(r?.message || 'Could not save.');
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    const r = await mPost(`/api/member/university/members/${id}`, { u, action: 'note', body: note });
    setBusy(false);
    if (r?.ok) { setNote(''); setD(x => ({ ...x, notes: [r.note, ...x.notes] })); }
    else setErr(r?.message || 'Could not save the note.');
  }

  const m = d?.member;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Member details"
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">Member</p>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>

        {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
        {!m && !err && <div className="mt-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div>}

        {m && (
          <>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={m.photo_url} name={m.full_name} className="h-14 w-14 rounded-full" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-bold" style={{ color: C.deep }}>{m.full_name}</p>
                <p className="font-mono text-[12px] text-gray-500">{m.membership_id}</p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl bg-gray-50 p-3 text-[13px]">
              {[
                ['University', m.university], ['Campus', m.campus || '—'],
                ['Department', m.department || '—'], ['Program', m.program || '—'],
                ['Position', m.position || '—'], ['Joined TNR', fmtDate(m.joined_at)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[11px] text-gray-500">{k}</dt>
                  <dd className="truncate font-medium text-gray-800" title={v}>{v}</dd>
                </div>
              ))}
            </dl>

            {d.contact ? (
              <div className="mt-3 rounded-2xl border border-gray-200 p-3 text-[13px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact (permitted by TNR)</p>
                {d.contact.email && <p className="mt-1">{d.contact.email}</p>}
                {d.contact.mobile && <p>{d.contact.mobile}</p>}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-gray-500">
                Contact details are not shown. Reach members through an announcement, or ask the
                TNR administration if you need direct contact.
              </p>
            )}

            <div className="mt-5">
              <p className="text-[13px] font-bold" style={{ color: C.deep }}>Follow-up</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FOLLOWUP_STATUSES.map(([k, label]) => (
                  <button key={k} type="button" disabled={busy} onClick={() => setFollowup(k)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                      m.followup === k ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    style={m.followup === k ? { background: C.green } : undefined}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[13px] font-bold" style={{ color: C.deep }}>Coordination notes</p>
              <p className="text-[12px] text-gray-500">Seen by your university&apos;s ambassadors and TNR administrators. Never by the member.</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={2000}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                placeholder="e.g. Spoke after the orientation; interested in the career fair." />
              <button type="button" onClick={addNote} disabled={busy || !note.trim()}
                className="mt-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: C.green }}>Add note</button>
              <ul className="mt-3 space-y-2">
                {d.notes.map(n => (
                  <li key={n.id} className="rounded-xl bg-gray-50 p-3 text-[13px]">
                    <p className="whitespace-pre-wrap text-gray-800">{n.body}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{n.author_name || 'Ambassador'} · {fmtDate(n.created_at)}</p>
                  </li>
                ))}
                {!d.notes.length && <li className="text-[12px] text-gray-400">No notes yet.</li>}
              </ul>
            </div>

            <button type="button" onClick={() => onRequest(m)}
              className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
              Something wrong on this record? Ask TNR to correct it
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

function Members({ u, onRequest }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState('all');
  const [followup, setFollowup] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const reqId = useRef(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [debounced, kind, followup, sort, u]);

  const load = useCallback(() => {
    const my = ++reqId.current;   // ignore responses that arrive out of order
    setErr('');
    const p = new URLSearchParams({ u, page: String(page), per: '25',
      sort: sort === 'joined' ? 'joined' : 'name', dir: sort === 'joined' ? 'desc' : 'asc' });
    if (debounced) p.set('q', debounced);
    if (kind !== 'all') p.set('kind', kind);
    if (followup) p.set('followup', followup);
    mGet(`/api/member/university/members?${p}`).then(r => {
      if (my !== reqId.current) return;
      if (r?.ok) setData(r); else setErr(r?.message || 'Could not load members.');
    });
  }, [u, page, debounced, kind, followup, sort]);
  useEffect(() => { load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.per)) : 1;
  const select = 'rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-600';

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input value={q} onChange={e => setQ(e.target.value)} type="search"
          placeholder="Search by name or membership ID"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 sm:w-72" />
        <select value={kind} onChange={e => setKind(e.target.value)} className={select} aria-label="Study status">
          <option value="all">Everyone</option>
          <option value="student">Current students</option>
          <option value="not_studying">Not studying</option>
        </select>
        <select value={followup} onChange={e => setFollowup(e.target.value)} className={select} aria-label="Follow-up">
          <option value="">Any follow-up</option>
          {FOLLOWUP_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className={select} aria-label="Sort">
          <option value="name">Name A–Z</option>
          <option value="joined">Newest first</option>
        </select>
      </div>

      {err && <Notice tone="error">{err}</Notice>}

      {!data && !err && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}

      {data && !data.members.length && (
        <Notice>
          {debounced || kind !== 'all' || followup
            ? 'No members match these filters.'
            : 'No members from this university yet. They will appear here as they join TNR and are approved.'}
        </Notice>
      )}

      {data && !!data.members.length && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Member</th><th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Program</th><th className="px-3 py-3">Joined</th>
                  <th className="px-3 py-3">Follow-up</th><th className="px-3 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {data.members.map(m => (
                  <tr key={m.id} className="border-t border-gray-100 transition hover:bg-emerald-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={m.photo_url} name={m.full_name} className="h-9 w-9 shrink-0 rounded-full" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{m.full_name}</p>
                          <p className="font-mono text-[11px] text-gray-500">
                            {m.membership_id}{m.campus ? ` · ${m.campus}` : ''}{m.student ? ' · Student' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-gray-700" title={m.department || ''}>{m.department || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{m.program || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{fmtDate(m.joined_at)}</td>
                    <td className="px-3 py-2.5"><Pill status={m.followup} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => setOpen(m.id)}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold hover:bg-emerald-50" style={{ color: C.green }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {data.members.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50">
                  <Avatar src={m.photo_url} name={m.full_name} className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-gray-900">{m.full_name}</p>
                    <p className="truncate text-[12px] text-gray-500">{m.department || m.program || m.membership_id}</p>
                  </div>
                  <Pill status={m.followup} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-[13px] text-gray-600">
            <span>{data.total} member{data.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}

      {open && (
        <MemberDrawer u={u} id={open} onClose={() => setOpen(null)} onChanged={load}
          onRequest={(m) => { setOpen(null); onRequest(m); }} />
      )}
    </div>
  );
}

// ── Announcements ───────────────────────────────────────────────────────────

function Announce({ u }) {
  const [info, setInfo] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    mGet(`/api/member/university/announce?u=${encodeURIComponent(u)}`).then(r => r?.ok && setInfo(r));
  }, [u]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!window.confirm('Send this announcement to every member of this university in TNR? It cannot be recalled.')) return;
    setBusy(true); setMsg(null);
    const r = await mPost('/api/member/university/announce', { u, title, body });
    setBusy(false);
    if (r?.ok) {
      setMsg({ tone: 'ok', text: `Sent to ${r.delivered} member${r.delivered === 1 ? '' : 's'}.` });
      setTitle(''); setBody(''); load();
    } else setMsg({ tone: 'error', text: r?.message || 'Could not send.' });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-3">
        <p className="text-[14px] font-bold" style={{ color: C.deep }}>New announcement</p>
        <p className="mt-1 text-[12px] text-gray-500">
          Delivered to members&apos; TNR notifications, signed with your name and role.
          {info && ` ${info.remaining_today} of ${info.limit} left today.`}
        </p>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Title"
          className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600" />
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={6}
          placeholder="What do your university's members need to know?"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">{body.length}/1000</span>
          <button type="button" onClick={send}
            disabled={busy || title.trim().length < 3 || body.trim().length < 5 || info?.remaining_today === 0}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: C.green }}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
        <p className="text-[14px] font-bold" style={{ color: C.deep }}>Sent</p>
        {!info && <Skeleton className="mt-3 h-24" />}
        <ul className="mt-2 divide-y divide-gray-100">
          {info?.history.map((h, i) => (
            <li key={i} className="py-2 text-[13px]">
              <p className="font-semibold text-gray-800">{h.title}</p>
              <p className="text-[11px] text-gray-500">{fmtDate(h.sent_at)} · {h.recipients} recipients</p>
            </li>
          ))}
          {info && !info.history.length && <li className="py-2 text-[12px] text-gray-400">Nothing sent yet.</li>}
        </ul>
      </div>
    </div>
  );
}

// ── Requests ────────────────────────────────────────────────────────────────

const REQ_TONE = { open: 'bg-amber-50 text-amber-800', in_progress: 'bg-sky-50 text-sky-800',
  resolved: 'bg-emerald-50 text-emerald-800', declined: 'bg-gray-100 text-gray-600' };

function Requests({ u, preset, clearPreset }) {
  const [list, setList] = useState(null);
  const [kind, setKind] = useState('correction');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    mGet(`/api/member/university/requests?u=${encodeURIComponent(u)}`).then(r => r?.ok && setList(r.requests));
  }, [u]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (preset) { setKind('correction'); setSubject(`Correction: ${preset.full_name} (${preset.membership_id})`); }
  }, [preset]);

  async function submit() {
    setBusy(true); setMsg(null);
    const r = await mPost('/api/member/university/requests', {
      u, kind, subject, message, member_id: preset?.id || null });
    setBusy(false);
    if (r?.ok) {
      setMsg({ tone: 'ok', text: 'Sent to the TNR administration.' });
      setSubject(''); setMessage(''); clearPreset(); load();
    } else setMsg({ tone: 'error', text: r?.message || 'Could not send.' });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
        <p className="text-[14px] font-bold" style={{ color: C.deep }}>Ask the TNR administration</p>
        <p className="mt-1 text-[12px] text-gray-500">
          Ambassadors cannot edit member records. Tell us what needs changing and an administrator will act on it.
        </p>
        {preset && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-[12px] text-emerald-900">
            About {preset.full_name} · <button type="button" className="underline" onClick={clearPreset}>remove</button>
          </p>
        )}
        <select value={kind} onChange={e => setKind(e.target.value)}
          className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[14px]">
          {REQUEST_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} placeholder="Subject"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600" />
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={3000} rows={5}
          placeholder="What is wrong, and what should it be?"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-emerald-600" />
        <button type="button" onClick={submit}
          disabled={busy || subject.trim().length < 3 || message.trim().length < 5}
          className="mt-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: C.green }}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </div>

      <div className="space-y-2 lg:col-span-3">
        {!list && <Skeleton className="h-32" />}
        {list && !list.length && <Notice>You have not raised any requests.</Notice>}
        {list?.map(r => (
          <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold text-gray-900">{r.subject}</p>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${REQ_TONE[r.status]}`}>
                {r.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-700">{r.message}</p>
            {r.admin_reply && (
              <p className="mt-2 rounded-xl bg-gray-50 p-2 text-[13px] text-gray-800">
                <strong>TNR:</strong> {r.admin_reply}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">{fmtDate(r.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function UniversityAmbassadorPortal() {
  const [tab, setTab] = useState('overview');
  const [u, setU] = useState('');
  const [data, setData] = useState(null);
  const [blocked, setBlocked] = useState(null);   // { code, message }
  const [preset, setPreset] = useState(null);

  useEffect(() => {
    setData(null);
    mGet(`/api/member/university${u ? `?u=${encodeURIComponent(u)}` : ''}`).then(r => {
      if (r?.ok) { setData(r); setBlocked(null); if (!u) setU(r.selected); }
      else setBlocked({ code: r?.error, message: r?.message || 'Could not open the ambassador portal.' });
    });
  }, [u]);

  const current = useMemo(() => data?.universities.find(x => x.id === (u || data?.selected)), [data, u]);

  return (
    <MemberShell active="/member/university">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.gold }}>University Ambassador</p>
            <h1 className="mt-1 text-[24px] font-black leading-tight" style={{ color: C.deep }}>
              {current?.name || (blocked ? 'My University' : ' ')}
            </h1>
            {current?.campuses?.some(Boolean) && (
              <p className="text-[13px] text-gray-500">Campus: {current.campuses.filter(Boolean).join(', ')}</p>
            )}
          </div>
          {data?.universities.length > 1 && (
            <select value={u} onChange={e => setU(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-[14px]" aria-label="University">
              {data.universities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </header>

        {blocked ? (
          <Notice tone={blocked.code === 'NOT_ASSIGNED' || blocked.code === 'FORBIDDEN' ? 'info' : 'error'}>
            {blocked.message}
          </Notice>
        ) : (
          <>
            <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1" aria-label="Sections">
              {TABS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-semibold transition ${
                    tab === k ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  style={tab === k ? { color: C.deep } : undefined}>
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'overview' && <Overview data={data} />}
            {tab === 'members' && u && <Members u={u} onRequest={(m) => { setPreset(m); setTab('requests'); }} />}
            {tab === 'announce' && u && <Announce u={u} />}
            {tab === 'requests' && u && <Requests u={u} preset={preset} clearPreset={() => setPreset(null)} />}
          </>
        )}
      </div>
    </MemberShell>
  );
}
