'use client';
import { useEffect, useMemo, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Field } from './ui';
import {
  VACANCY_STATUSES, APP_STATUSES, APP_STATUS_LABEL, APP_STATUS_TONE,
  WRITTEN_QUESTIONS,
} from '@/lib/cec';

/* Executive Committee recruitment.
 *
 * Two panes: the positions being advertised, and the applications received.
 * An admin can move an application through the pipeline and add notes, but
 * cannot edit what an applicant wrote — the answers are the record being
 * judged, and a panel able to quietly rewrite them is not a fair process.
 */
export default function CecTab({ toast }) {
  const [pane, setPane] = useState('applications');
  // Asked of the server rather than assumed: the client never decides its own
  // rank, and the decision endpoint enforces this independently.
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => { aGet('/api/admin/me').then(r => setIsSuper(!!r?.is_super)); }, []);

  return <div className="space-y-4 max-w-4xl">
    <div className="flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
      {[['applications', 'Applications'], ['vacancies', 'Positions']].map(([k, l]) => (
        <button key={k} onClick={() => setPane(k)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition
            ${pane === k ? 'bg-tnr-gold text-tnr-black' : 'text-tnr-cream/70 hover:bg-white/5'}`}>
          {l}
        </button>
      ))}
    </div>
    {pane === 'applications'
      ? <Applications toast={toast} isSuper={isSuper} />
      : <Vacancies toast={toast} />}
  </div>;
}

/* ── Applications ────────────────────────────────────────────────────────── */
function Applications({ toast, isSuper }) {
  const [rows, setRows] = useState(null);
  const [vacancies, setVacancies] = useState([]);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [vac, setVac] = useState('');
  const [openId, setOpenId] = useState(null);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/cec/applications');
    if (!r?.ok) {
      setErr(`${r?.message || 'Could not load applications.'}${r?.hint ? ` — ${r.hint}` : ''}`);
      setRows([]); return;
    }
    setRows(r.applications); setVacancies(r.vacancies || []);
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows || []).filter(a =>
    (!status || a.status === status) && (!vac || a.vacancy_id === vac)
  ), [rows, status, vac]);

  const counts = useMemo(() => {
    const c = {};
    for (const a of rows || []) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [rows]);

  if (!rows) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  return <div className="space-y-4">
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    <Card>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
        {APP_STATUSES.map(([k, l]) => (
          <button key={k} onClick={() => setStatus(status === k ? '' : k)}
            className={`rounded-lg py-2 transition ${status === k ? 'bg-tnr-gold/20' : 'hover:bg-white/5'}`}>
            <div className="text-xl font-black text-tnr-goldLight">{counts[k] || 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{l}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={vac} onChange={e => setVac(e.target.value)}>
          <option value="">All positions</option>
          {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
        <span className="text-[12px] text-tnr-cream/50">
          {shown.length} of {rows.length} shown
        </span>
        {(status || vac) && (
          <button className="text-[12px] underline text-tnr-goldLight"
            onClick={() => { setStatus(''); setVac(''); }}>Clear filters</button>
        )}
      </div>
    </Card>

    {!shown.length && (
      <Card><div className="text-sm text-tnr-cream/50">
        {rows.length ? 'No applications match these filters.' : 'No applications received yet.'}
      </div></Card>
    )}

    {shown.map(a => (
      <ApplicationRow key={a.id} a={a} toast={toast} onDone={load} isSuper={isSuper}
        open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
    ))}
  </div>;
}

const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function ApplicationRow({ a, toast, onDone, open, onToggle, isSuper }) {
  const [notes, setNotes] = useState(a.admin_notes || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNotes(a.admin_notes || ''); }, [a.admin_notes]);

  const tone = APP_STATUS_TONE[a.status] || {};

  async function patch(body, msg) {
    setBusy(true);
    const r = await aPatch(`/api/admin/cec/applications/${a.id}`, body);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Save failed', 'err');
    toast(msg || 'Saved'); onDone();
  }

  async function remove() {
    if (!confirm(`Delete the application from ${a.full_name}? This cannot be undone.`)) return;
    setBusy(true);
    const r = await aDel(`/api/admin/cec/applications/${a.id}`);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Application deleted'); onDone();
  }

  const answers = [
    ['Relevant experience', a.relevant_experience],
    ['Scenario question', a.scenario_answer],
    [WRITTEN_QUESTIONS[1][1], a.challenge_answer],
    [WRITTEN_QUESTIONS[2][1], a.leadership_answer],
    [WRITTEN_QUESTIONS[3][1], a.vision_answer],
  ].filter(([, v]) => v);

  return <Card>
    <div className="flex flex-wrap items-center gap-2">
      <button className="font-bold text-tnr-cream text-left" onClick={onToggle}>
        {a.full_name || '(no name)'}
      </button>
      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
        style={{ background: tone.bg, color: tone.fg }}>
        {APP_STATUS_LABEL[a.status] || a.status}
      </span>
      <span className="text-[11px] text-tnr-cream/50">{a.position}</span>
      {a.reference_no && <span className="text-[11px] text-tnr-cream/40 tabular-nums">{a.reference_no}</span>}
      <span className="text-[11px] text-tnr-cream/40 ml-auto">{fmt(a.created_at)}</span>
      <button className="btn-ghost !py-1 !px-3 text-xs" onClick={onToggle}>
        {open ? 'Collapse' : 'Review'}
      </button>
    </div>

    {open && <div className="mt-4 space-y-4">
      {/* ── Contact and background ── */}
      <div className="rounded-xl border border-tnr-line/60 p-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
        {[
          ['Email', a.email], ['Phone', a.mobile],
          ['Qualification', a.education_level],
          ['Occupation', [a.current_position, a.organisation].filter(Boolean).join(' · ')],
          ['Area', [a.village, a.union_council].filter(Boolean).join(', ')],
          ['Membership no.', a.membership_id],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-tnr-line/40 py-1">
            <span className="text-tnr-cream/50">{k}</span>
            <span className="text-tnr-cream text-right">{v}</span>
          </div>
        ))}
      </div>

      {/* ── Written answers ── */}
      {answers.map(([q, v]) => (
        <div key={q}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-tnr-goldLight mb-1">{q}</div>
          <p className="text-[13px] leading-relaxed text-tnr-cream/80 whitespace-pre-line">{v}</p>
        </div>
      ))}

      {a.cv_url && (
        <a href={a.cv_url} target="_blank" rel="noopener noreferrer"
          className="inline-block text-[13px] font-bold underline text-tnr-goldLight">Open CV ↗</a>
      )}

      {/* ── Panel notes ── */}
      <Field label="Panel notes (never shown to the applicant)">
        <textarea className="input min-h-[70px]" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" disabled={busy}
          onClick={() => patch({ admin_notes: notes }, 'Notes saved')}>Save notes</button>
        {a.reviewed_by && (
          <span className="text-[11px] text-tnr-cream/40">
            Last reviewed by {a.reviewed_by}{a.reviewed_at ? ` on ${fmt(a.reviewed_at)}` : ''}
          </span>
        )}
      </div>

      {/* ── Decision ──
          Super Admin only. Any admin may record an opinion in the notes above,
          but the outcome is one person's call and the server refuses it from
          anyone else — so the buttons are not shown rather than shown and
          rejected. */}
      <div className="pt-2 border-t border-tnr-line/60">
        {isSuper ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-tnr-cream/40 mr-1">Decision</span>
            {APP_STATUSES.filter(([k]) => k !== a.status).map(([k, l]) => (
              <button key={k} className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busy}
                onClick={() => patch({ status: k, admin_notes: notes }, `Moved to ${l}`)}>
                {l}
              </button>
            ))}
            <button className="btn-ghost !text-red-300 ml-auto text-xs" disabled={busy} onClick={remove}>Delete</button>
          </div>
        ) : (
          <p className="text-[12px] text-tnr-cream/50">
            Only a Super Admin can move an application to Selected or Not selected.
            Your notes above are saved and visible to the panel.
          </p>
        )}
      </div>
    </div>}
  </Card>;
}

/* ── Positions ───────────────────────────────────────────────────────────── */
function Vacancies({ toast }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/cec/vacancies');
    if (!r?.ok) {
      setErr(`${r?.message || 'Could not load positions.'}${r?.hint ? ` — ${r.hint}` : ''}`);
      setRows([]); return;
    }
    setRows(r.vacancies);
  }
  useEffect(() => { load(); }, []);

  if (!rows) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  return <div className="space-y-4">
    <p className="text-sm text-tnr-cream/60">
      Only positions set to <b>Open</b> appear on the public form, and each one
      closes itself on its closing date.
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    {rows.map(v => <VacancyEditor key={v.id} row={v} toast={toast} onDone={load} />)}

    {draft
      ? <VacancyEditor row={draft} isNew toast={toast}
          onDone={() => { setDraft(null); load(); }} onCancel={() => setDraft(null)} />
      : <button className="btn" onClick={() => setDraft({
          title: '', seats: 1, summary: '', scenario_question: '', eligibility_note: '',
          responsibilities: '', requirements: '', closes_on: '', status: 'open', sort_order: 0,
        })}>+ Add position</button>}
  </div>;
}

const asText = (v) => Array.isArray(v) ? v.join('\n') : (v || '');

function VacancyEditor({ row, isNew, toast, onDone, onCancel }) {
  const [f, setF] = useState({ ...row, responsibilities: asText(row.responsibilities), requirements: asText(row.requirements) });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!!isNew);
  useEffect(() => {
    setF({ ...row, responsibilities: asText(row.responsibilities), requirements: asText(row.requirements) });
  }, [row]);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  async function save(overrides = {}) {
    const body = { ...f, ...overrides };
    if (!String(body.title || '').trim()) return toast('Give the position a title.', 'err');
    setBusy(true);
    const r = isNew ? await aPost('/api/admin/cec/vacancies', body)
                    : await aPatch(`/api/admin/cec/vacancies/${f.id}`, body);
    setBusy(false);
    if (!r?.ok) return toast(`${r?.message || 'Save failed'}${r?.hint ? ` — ${r.hint}` : ''}`, 'err');
    toast(r.message || 'Saved'); onDone();
  }

  async function remove() {
    if (!confirm(`Delete “${f.title}”?`)) return;
    setBusy(true);
    const r = await aDel(`/api/admin/cec/vacancies/${f.id}`);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Position deleted'); onDone();
  }

  if (!isNew && !open) {
    return <Card>
      <div className="flex flex-wrap items-center gap-2">
        <button className="font-bold text-tnr-cream text-left" onClick={() => setOpen(true)}>{f.title}</button>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${f.status === 'open'
          ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-tnr-cream/50'}`}>
          {VACANCY_STATUSES.find(([k]) => k === f.status)?.[1] || f.status}
        </span>
        {f.closes_on && <span className="text-[11px] text-tnr-cream/40">Closes {fmt(f.closes_on)}</span>}
        <span className="text-[11px] text-tnr-cream/50">
          {row.counts?.total || 0} application{(row.counts?.total || 0) === 1 ? '' : 's'}
          {row.counts?.new ? ` · ${row.counts.new} new` : ''}
        </span>
        <button className="btn-ghost !py-1 !px-3 text-xs ml-auto" onClick={() => setOpen(true)}>Edit</button>
      </div>
    </Card>;
  }

  return <Card>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-black text-tnr-cream">{isNew ? 'New position' : f.title}</h3>
      {!isNew && <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setOpen(false)}>Collapse</button>}
    </div>

    <div className="grid sm:grid-cols-4 gap-3">
      <div className="sm:col-span-2">
        <Field label="Title"><input className="input" value={f.title || ''} onChange={set('title')} /></Field>
      </div>
      <Field label="Seats"><input type="number" min="1" className="input" value={f.seats ?? 1} onChange={set('seats')} /></Field>
      <Field label="Status">
        <select className="input" value={f.status} onChange={set('status')}>
          {VACANCY_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Closing date"><input type="date" className="input" value={f.closes_on || ''} onChange={set('closes_on')} /></Field>
      <Field label="Order"><input type="number" className="input" value={f.sort_order ?? 0} onChange={set('sort_order')} /></Field>
    </div>

    <Field label="Short summary">
      <textarea className="input min-h-[60px]" value={f.summary || ''} onChange={set('summary')} />
    </Field>

    <Field label="Scenario question for this position">
      <textarea className="input min-h-[80px]" value={f.scenario_question || ''} onChange={set('scenario_question')}
        placeholder="The situational question applicants for this post must answer." />
    </Field>
    <p className="-mt-1 mb-3 text-[11px] text-tnr-cream/40">
      Each position gets its own question — it appears on the form as soon as the
      applicant selects this post.
    </p>

    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Responsibilities — one per line">
        <textarea className="input min-h-[80px]" value={f.responsibilities || ''} onChange={set('responsibilities')} />
      </Field>
      <Field label="Requirements — one per line">
        <textarea className="input min-h-[80px]" value={f.requirements || ''} onChange={set('requirements')} />
      </Field>
    </div>

    <Field label="Eligibility note">
      <input className="input" value={f.eligibility_note || ''} onChange={set('eligibility_note')}
        placeholder="e.g. This position is open to female applicants." />
    </Field>

    <div className="flex flex-wrap items-center gap-2 mt-4">
      <button className="btn" disabled={busy} onClick={() => save()}>
        {busy ? 'Saving…' : (isNew ? 'Add position' : 'Save')}
      </button>
      {isNew
        ? <button className="btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        : <>
            <button className="btn-ghost" disabled={busy}
              onClick={() => save({ status: f.status === 'open' ? 'closed' : 'open' })}>
              {f.status === 'open' ? 'Close applications' : 'Open applications'}
            </button>
            <button className="btn-ghost !text-red-300 ml-auto" disabled={busy} onClick={remove}>Delete</button>
          </>}
    </div>
  </Card>;
}
