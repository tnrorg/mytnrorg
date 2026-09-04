'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aGet, aPost, aDel } from './adminApi';
import { Card } from './ui';
import {
  SOURCES, BANDS, ACTIVITY_TYPES, activityLabel, activityIcon,
  fmtActivityDate, availableYears, TNR_TZ,
} from '@/lib/contributions';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';
const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };

/* Progress Analytics.
 *
 * Who is contributing what, over a calendar year.
 *
 * THE ORGANISATION'S RULES, VISIBLE IN THE UI RATHER THAN ONLY IN THE DATA:
 *
 *   • No score and no rank. Columns are counts. The table can be SORTED —
 *     that is how you find the twelve people nobody has heard from — but
 *     nothing is labelled "1st" or "top contributor", and no position is
 *     stored or exported.
 *
 *   • "Nothing recorded" is a prompt to make a phone call, not a verdict. The
 *     empty state for that filter says so, because a list of names under a red
 *     heading is read as a list of failures by whoever opens it next.
 *
 *   • Attendance is always shown as "attended OF INVITED". A member invited to
 *     two meetings who came to both is at 100%, and must never appear beside
 *     someone invited to twenty as though they had done less.
 */
export default function ProgressAnalyticsTab({ toast }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [band, setBand] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('name');
  const [open, setOpen] = useState(null);      // member row being drilled into
  const [logging, setLogging] = useState(null); // member the dialog is for

  const load = useCallback(() => {
    setLoading(true);
    aGet(`/api/admin/analytics?year=${year}`)
      .then(r => setD(r?.ok ? r : { rows: [], summary: {}, missing: [] }))
      .finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const S = d?.summary || {};

  const rows = useMemo(() => {
    let list = d?.rows || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r => [r.member.full_name, r.member.membership_id, r.member.union_council]
        .some(v => String(v || '').toLowerCase().includes(q)));
    }
    if (band) list = list.filter(r => r.band === band);
    if (role) list = list.filter(r => r.member.role === role);

    const by = {
      name: (a, b) => a.member.full_name.localeCompare(b.member.full_name),
      total: (a, b) => b.total - a.total,
      meetings: (a, b) => b.record.meetings.attended - a.record.meetings.attended,
      /* Members invited to nothing sort LAST, not first.
       *
       * attendance_rate is null for them, and null sorting to the top of an
       * ascending list would fill the screen with people who were never asked
       * to anything, under a heading about attendance. */
      rate: (a, b) => (a.attendance_rate ?? -1) === (b.attendance_rate ?? -1)
        ? 0 : (b.attendance_rate ?? -1) - (a.attendance_rate ?? -1),
      activities: (a, b) => b.record.activities.count - a.record.activities.count,
    };
    return [...list].sort(by[sort] || by.name);
  }, [d, search, band, role, sort]);

  const roles = useMemo(
    () => [...new Set((d?.rows || []).map(r => r.member.role).filter(Boolean))].sort(),
    [d]);

  /* Export what is on screen, not the whole database.
   *
   * The filters are the point: an office bearer exports "Advisory Council,
   * nothing recorded" to take into a meeting. Exporting everything regardless
   * would make them filter it again in Excel. */
  function exportCsv() {
    const esc = (v) => {
      const s = String(v ?? '');
      // A leading =, +, - or @ makes Excel treat a name as a formula.
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const head = ['Membership ID', 'Name', 'Role', 'Union Council',
      'Meetings invited', 'Meetings attended', 'Attendance %', 'Minutes present',
      'Opinions', 'Comments', 'Field activities', 'Hours', 'Meetings hosted',
      'Leadership duties', 'Total contributions'];
    const body = rows.map(r => [
      r.member.membership_id, r.member.full_name, r.member.role, r.member.union_council,
      r.record.meetings.invited, r.record.meetings.attended,
      r.attendance_rate === null ? 'not invited' : r.attendance_rate,
      r.record.meetings.minutes,
      r.record.writing.opinions, r.record.writing.comments,
      r.record.activities.count, r.record.activities.hours,
      r.record.leadership.hosted, r.record.leadership.duties, r.total,
    ]);
    // BOM so Excel opens Urdu and accented names correctly instead of mojibake.
    const csv = '﻿' + [head, ...body].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `tnr-contributions-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (open) {
    return <MemberRecord row={open} year={year} toast={toast}
      onBack={() => { setOpen(null); load(); }}
      onLog={() => setLogging(open.member)} logging={logging}
      closeLog={(changed) => { setLogging(null); if (changed) load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tnr-cream">Progress Analytics</h2>
          <p className="text-sm text-tnr-cream/50">
            Participation and contribution across the organisation, {year}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className={`${input} w-auto`}>
            {availableYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setLogging({})}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: LIGHT.green }}>
            + Log activity
          </button>
          <button onClick={exportCsv} disabled={!rows.length}
            className="rounded-xl border border-tnr-line px-4 py-2 text-sm font-bold text-tnr-cream disabled:opacity-40">
            Export CSV
          </button>
        </div>
      </div>

      {/* A missing table means missing figures, and that must not read as a
          quiet year. */}
      {!!d?.missing?.length && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          <b>These figures are incomplete.</b> Could not read: {d.missing.join(', ')}.
          {d.hint && <> {d.hint}</>} Until then the columns below are undercounting,
          not reporting inactivity.
        </div>
      )}

      {/* ── Organisation totals ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat n={S.members} label="Active members" />
        <Stat n={S.meetings_held} label={`Meetings held in ${year}`} />
        <Stat n={S.attended} label="Attendances" />
        <Stat n={(S.opinions || 0) + (S.comments || 0)} label="Opinions & comments" />
        <Stat n={S.activities} label="Field activities" />
        <Stat n={S.hours} label="Hours logged" />
      </div>

      {/* ── Bands, as filters ── */}
      <div className="flex flex-wrap gap-2">
        {BANDS.map(bnd => (
          <button key={bnd.key} onClick={() => setBand(band === bnd.key ? '' : bnd.key)}
            title={bnd.hint}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${band === bnd.key
              ? 'border-tnr-gold/50 bg-tnr-gold/10 text-tnr-cream'
              : 'border-tnr-line text-tnr-cream/70 hover:bg-white/5'}`}>
            {bnd.label} · {S[bnd.key] ?? 0}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, membership ID or union council…"
          className={`${input} min-w-[220px] flex-1`} />
        <select value={role} onChange={e => setRole(e.target.value)} className={`${input} w-auto`}>
          <option value="">All roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className={`${input} w-auto`}>
          <option value="name">Sort: name</option>
          <option value="total">Sort: most recorded</option>
          <option value="meetings">Sort: meetings attended</option>
          <option value="rate">Sort: attendance rate</option>
          <option value="activities">Sort: field activities</option>
        </select>
      </div>

      {loading && !d && (
        <Card><div className="py-10 text-center text-sm text-tnr-cream/40">
          Reading a year of activity…
        </div></Card>
      )}

      {d && !rows.length && (
        <Card><div className="py-10 text-center text-sm text-tnr-cream/50">
          {band === 'none'
            ? 'Nobody is without a recorded contribution this year.'
            : 'No members match these filters.'}
        </div></Card>
      )}

      {band === 'none' && rows.length > 0 && (
        <div className="rounded-2xl border border-tnr-line bg-white/5 px-4 py-3 text-[13px] text-tnr-cream/70">
          These members have nothing recorded for {year}. That may mean they were
          never invited to anything, or that their work in Roundu has not been
          logged yet — not that they have done nothing. Worth a call before it is
          worth a conclusion.
        </div>
      )}

      {/* ── The table ── */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-tnr-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tnr-line text-left text-[10px] uppercase tracking-wider text-tnr-cream/40">
                {['Member', 'Role', 'Meetings', 'Attendance', 'Writing', 'Field work', 'Leadership', 'Total', ''].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.member.id} className="border-b border-tnr-line/50 hover:bg-white/5">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-tnr-cream">{r.member.full_name}</div>
                    <div className="text-[11px] text-tnr-cream/40">
                      {r.member.membership_id}
                      {r.member.union_council ? ` · ${r.member.union_council}` : ''}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-tnr-cream/60">{r.member.role || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tnr-cream/80">
                    {r.record.meetings.attended}
                    <span className="text-tnr-cream/40"> / {r.record.meetings.invited}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {/* Never 0% for somebody nobody invited. */}
                    {r.attendance_rate === null
                      ? <span className="text-[11px] text-tnr-cream/30">not invited</span>
                      : <span className="text-tnr-cream/80">{r.attendance_rate}%</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tnr-cream/80">
                    {r.record.writing.opinions + r.record.writing.comments}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tnr-cream/80">
                    {r.record.activities.count}
                    {r.record.activities.hours
                      ? <span className="text-tnr-cream/40"> · {r.record.activities.hours}h</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tnr-cream/80">
                    {r.record.leadership.hosted + r.record.leadership.duties}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-bold text-tnr-cream">{r.total}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <button onClick={() => setOpen(r)}
                      className="text-xs text-tnr-goldLight hover:underline">Record</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-tnr-cream/40">
        Figures cover 1 January – 31 December {year} in {TNR_TZ.split('/').pop().replace(/_/g, ' ')} time.
        Meetings, opinions and comments are counted automatically; field work is
        counted only where an office bearer has logged it. There is no score and
        no ranking — these are counts, and a low one is a question, not an answer.
      </p>

      {logging && (
        <LogActivity member={logging.id ? logging : null}
          members={(d?.rows || []).map(r => r.member)}
          toast={toast}
          onClose={(changed) => { setLogging(null); if (changed) load(); }} />
      )}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="rounded-xl border border-tnr-line px-3 py-2.5">
      <div className="text-xl font-black tabular-nums text-tnr-cream">{n ?? 0}</div>
      <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{label}</div>
    </div>
  );
}

/* ── One member's year ───────────────────────────────────────────────────── */
function MemberRecord({ row, year, toast, onBack, onLog, logging, closeLog }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    aGet(`/api/admin/analytics?year=${year}&member_id=${row.member.id}`)
      .then(r => setD(r?.ok ? r : null));
  }, [year, row.member.id]);
  useEffect(() => { load(); }, [load]);

  async function removeActivity(it) {
    if (!confirm(`Remove "${it.title}" from ${row.member.full_name}'s record?\n\nThis cannot be undone.`)) return;
    setBusy(it.id);
    const r = await aDel(`/api/admin/analytics?id=${it.id}`);
    setBusy(null);
    toast?.(r?.ok ? r.message : (r?.message || 'Could not remove it.'), r?.ok ? 'ok' : 'err');
    if (r?.ok) load();
  }

  const m = d?.record?.meetings;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-tnr-cream/60 hover:underline">
        ← Back to Progress Analytics
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tnr-cream">{row.member.full_name}</h2>
          <p className="text-sm text-tnr-cream/50">
            {row.member.membership_id}
            {row.member.role ? ` · ${row.member.role}` : ''}
            {row.member.union_council ? ` · ${row.member.union_council}` : ''} · {year}
          </p>
        </div>
        <button onClick={onLog}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: LIGHT.green }}>
          + Log activity for this member
        </button>
      </div>

      {!d && <Card><div className="py-10 text-center text-sm text-tnr-cream/40">Loading…</div></Card>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SOURCES.map(s => {
              const n = s.key === 'meetings' ? (m?.attended || 0)
                : s.key === 'writing' ? (d.record?.writing.opinions || 0) + (d.record?.writing.comments || 0)
                  : s.key === 'activities' ? (d.record?.activities.count || 0)
                    : (d.record?.leadership.hosted || 0) + (d.record?.leadership.duties || 0);
              return (
                <div key={s.key} className="rounded-xl border border-tnr-line px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">
                    {s.icon} {s.label}
                  </div>
                  <div className="mt-1 text-2xl font-black tabular-nums text-tnr-cream">{n}</div>
                </div>
              );
            })}
          </div>

          {m?.invited > 0 && (
            <Card>
              <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 py-1 text-sm text-tnr-cream/70">
                <span><b className="text-tnr-cream">{m.attended}</b> attended of <b className="text-tnr-cream">{m.invited}</b> invited</span>
                <span><b className="text-tnr-cream">{m.partial}</b> joined briefly</span>
                <span><b className="text-tnr-cream">{m.late}</b> joined late</span>
                <span><b className="text-tnr-cream">{m.absent}</b> missed</span>
                <span><b className="text-tnr-cream">{m.minutes}</b> minutes present</span>
              </div>
            </Card>
          )}

          <h3 className="text-sm font-bold text-tnr-cream">Everything recorded in {year}</h3>

          {!d.timeline?.length && (
            <Card><div className="py-8 text-center text-sm text-tnr-cream/50">
              Nothing recorded for {year}. If this member has taken part in
              activities, log them so the record reflects it.
            </div></Card>
          )}

          <ol className="space-y-2">
            {(d.timeline || []).map((it, i) => (
              <li key={`${it.kind}-${it.id || i}`}
                className="flex gap-3 rounded-2xl border border-tnr-line px-4 py-3">
                <span className="text-lg leading-none">
                  {it.kind === 'meeting' ? '🎥' : it.kind === 'opinion' ? '✍️' : activityIcon(it.activity_type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold text-tnr-cream">{it.title}</p>
                    <span className="text-[11px] text-tnr-cream/40">
                      {it.kind === 'activity' ? fmtActivityDate(it.date)
                        : new Date(it.at).toLocaleDateString('en-GB',
                          { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[12px] text-tnr-cream/50">
                    {it.kind === 'activity' ? activityLabel(it.activity_type) : it.detail}
                    {it.kind === 'activity' && it.hours ? ` · ${it.hours} hr` : ''}
                    {it.kind === 'activity' && it.location ? ` · ${it.location}` : ''}
                  </p>
                  {it.kind === 'activity' && it.detail && (
                    <p className="mt-1 whitespace-pre-line text-[12.5px] text-tnr-cream/70">{it.detail}</p>
                  )}
                </div>
                {/* Only hand-logged entries can be removed here. An attendance
                    record or a published opinion is a fact from another module
                    and is corrected there, not quietly deleted from a report. */}
                {it.kind === 'activity' && (
                  <button onClick={() => removeActivity(it)} disabled={busy === it.id}
                    className="self-start text-[11px] text-red-300 hover:underline disabled:opacity-40">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {logging && (
        <LogActivity member={logging.id ? logging : row.member}
          members={[row.member]} toast={toast}
          onClose={(changed) => { closeLog(changed); if (changed) load(); }} />
      )}
    </div>
  );
}

/* ── Logging the work the platform cannot see ────────────────────────────── */
function LogActivity({ member, members, toast, onClose }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TNR_TZ });
  const [f, setF] = useState({
    member_id: member?.id || '',
    activity_type: 'field_activity',
    title: '', description: '', activity_date: today,
    hours: '', location: '', evidence_url: '',
  });
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: null })); };

  const found = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (members || []).filter(mm =>
      [mm.full_name, mm.membership_id].some(v => String(v || '').toLowerCase().includes(term)))
      .slice(0, 8);
  }, [q, members]);

  const chosen = (members || []).find(mm => mm.id === f.member_id) || member || null;

  async function save() {
    setSaving(true);
    const r = await aPost('/api/admin/analytics', {
      ...f, hours: f.hours === '' ? null : Number(f.hours),
    });
    setSaving(false);
    if (!r?.ok) {
      setErrors(r?.errors || {});
      return toast?.([r?.message, r?.detail].filter(Boolean).join(' ') || 'Could not save.', 'err');
    }
    toast?.(r.message, 'ok');
    onClose(true);
  }

  const Err = ({ k }) => errors[k]
    ? <p className="mt-1 text-[12px] font-semibold text-red-600">{errors[k]}</p> : null;
  const li = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-black" style={{ color: LIGHT.deep }}>Log an activity</h3>
        <p className="mt-1 text-[12.5px] text-gray-500">
          For work done in Roundu that the platform cannot see. It appears on the
          member&apos;s own record too, so record it as it happened.
        </p>

        <div className="mt-4 space-y-3">
          {/* Member */}
          <div>
            <label className="text-[12px] font-bold text-gray-600">Member</label>
            {chosen ? (
              <div className="mt-1 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">
                  {chosen.full_name}
                  <span className="ml-1.5 text-[12px] font-normal text-gray-500">{chosen.membership_id}</span>
                </span>
                {!member && (
                  <button onClick={() => { set('member_id', ''); setQ(''); }}
                    className="text-[12px] text-gray-500 hover:underline">Change</button>
                )}
              </div>
            ) : (
              <>
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Search by name or membership ID…" className={`${li} mt-1`} />
                {found.length > 0 && (
                  <ul className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-gray-200">
                    {found.map(mm => (
                      <li key={mm.id}>
                        <button onClick={() => { set('member_id', mm.id); setQ(''); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                          {mm.full_name}
                          <span className="ml-1.5 text-[12px] text-gray-500">{mm.membership_id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Err k="member_id" />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-600">What kind of activity</label>
            <select value={f.activity_type} onChange={e => set('activity_type', e.target.value)}
              className={`${li} mt-1`}>
              {ACTIVITY_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11.5px] text-gray-400">
              {ACTIVITY_TYPES.find(t => t.key === f.activity_type)?.hint}
            </p>
            <Err k="activity_type" />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-600">Title</label>
            <input value={f.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Cleanliness drive at Roundu bazaar" className={`${li} mt-1`} />
            <Err k="title" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-[12px] font-bold text-gray-600">Date it happened</label>
              <input type="date" value={f.activity_date} max={today}
                onChange={e => set('activity_date', e.target.value)} className={`${li} mt-1`} />
              <Err k="activity_date" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-gray-600">Hours</label>
              <input type="number" min="0" max="24" step="0.5" value={f.hours}
                onChange={e => set('hours', e.target.value)}
                placeholder="optional" className={`${li} mt-1`} />
              <Err k="hours" />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-600">Where</label>
            <input value={f.location} onChange={e => set('location', e.target.value)}
              placeholder="optional — village or union council" className={`${li} mt-1`} />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-600">What they did</label>
            <textarea rows={3} value={f.description} onChange={e => set('description', e.target.value)}
              placeholder="optional — a sentence or two, so the record still makes sense next year"
              className={`${li} mt-1 resize-y`} />
          </div>

          <div>
            <label className="text-[12px] font-bold text-gray-600">Link to a photo or report</label>
            <input value={f.evidence_url} onChange={e => set('evidence_url', e.target.value)}
              placeholder="optional — https://…" className={`${li} mt-1`} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => onClose(false)}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !f.member_id}
            className="rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: LIGHT.green }}>
            {saving ? 'Saving…' : 'Record it'}
          </button>
        </div>
      </div>
    </div>
  );
}
