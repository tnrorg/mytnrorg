'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Field } from './ui';
import {
  PROJECT_STATUSES, PROJECT_CATEGORIES, STATUS_LABEL, blankProject, summarise, money,
} from '@/lib/projects';
import { resizeImage } from '@/lib/imageResize';
import AreaSelect from './AreaSelect';
import GalleryPicker from './GalleryPicker';

/* Development projects — what the public accountability page shows.
 *
 * Nothing on that page is derived from anything else, so whatever is entered
 * here is exactly what residents see. Two fields matter more than they look:
 * `source` and `last verified`. Publishing public-spending figures without
 * being able to say where they came from, or when they were last checked, is
 * how a transparency page becomes a liability.
 */
export default function ProjectsTab({ toast }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/projects');
    if (!r?.ok) {
      setErr(`${r?.message || 'Could not load projects.'}${r?.hint ? ` — ${r.hint}` : ''}`);
      setRows([]); return;
    }
    setRows(r.projects);
  }
  useEffect(() => { load(); }, []);

  if (!rows) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  const s = summarise(rows.filter(r => r.published));

  return <div className="space-y-4 max-w-4xl">
    <p className="text-sm text-tnr-cream/60">
      Development schemes shown on the public projects page. Only published
      projects are counted in the public totals.
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    <PageSettings toast={toast} />

    {!!rows.length && (
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          {[['Published', s.total], ['Pending', s.pending], ['Ongoing', s.ongoing],
            ['Completed', s.completed], ['Approved cost', money(s.approvedCost)]].map(([l, v]) => (
            <div key={l}>
              <div className="text-xl font-black text-tnr-goldLight">
                {typeof v === 'number' ? v.toLocaleString() : v}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{l}</div>
            </div>
          ))}
        </div>
      </Card>
    )}

    {rows.map(row => <ProjectEditor key={row.id} row={row} toast={toast} onDone={load} />)}

    {draft
      ? <ProjectEditor row={draft} isNew toast={toast}
          onDone={() => { setDraft(null); load(); }} onCancel={() => setDraft(null)} />
      : <button className="btn" onClick={() => setDraft(blankProject())}>+ Add project</button>}
  </div>;
}

/* ── Page heading and attribution ───────────────────────────────────────── */
function PageSettings({ toast }) {
  const [f, setF] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await aGet('/api/admin/project-settings');
    setF(r?.ok ? (r.settings || {}) : { currency: 'PKR' });
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    const r = await aPatch('/api/admin/project-settings', f);
    setBusy(false);
    if (!r?.ok) return toast(`${r?.message || 'Save failed'}${r?.hint ? ` — ${r.hint}` : ''}`, 'err');
    toast('Page settings saved');
  }

  if (!f) return null;

  if (!open) {
    return <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold text-tnr-cream">{f.page_title || 'Development Projects'}</div>
          <div className="text-[11px] text-tnr-cream/50">
            {[f.representative_name, f.constituency].filter(Boolean).join(' · ') || 'No attribution set'}
          </div>
        </div>
        <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setOpen(true)}>Edit page heading</button>
      </div>
    </Card>;
  }

  return <Card>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-black text-tnr-cream">Page heading &amp; attribution</h3>
      <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setOpen(false)}>Collapse</button>
    </div>
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Page title"><input className="input" value={f.page_title || ''} onChange={set('page_title')} placeholder="Development Projects" /></Field>
      <Field label="Constituency"><input className="input" value={f.constituency || ''} onChange={set('constituency')} placeholder="GBA-__ Roundu" /></Field>
      <Field label="Representative name"><input className="input" value={f.representative_name || ''} onChange={set('representative_name')} /></Field>
      <Field label="Representative title"><input className="input" value={f.representative_title || ''} onChange={set('representative_title')} placeholder="Minister for …" /></Field>
      <Field label="Currency"><input className="input" value={f.currency || 'PKR'} onChange={set('currency')} /></Field>
    </div>
    <Field label="Introduction">
      <textarea className="input min-h-[70px]" value={f.page_intro || ''} onChange={set('page_intro')}
        placeholder="One or two sentences explaining what this page covers." />
    </Field>
    <Field label="Where the figures come from">
      <textarea className="input min-h-[70px]" value={f.source_note || ''} onChange={set('source_note')}
        placeholder="e.g. Figures are as notified by the Planning &amp; Development Department and are not independently audited." />
    </Field>
    <p className="-mt-1 mb-3 text-[11px] text-tnr-cream/40">
      This note appears at the top of the public page. Naming the source protects
      TNR if a figure is later disputed.
    </p>
    <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save page settings'}</button>
  </Card>;
}

/* ── One project ────────────────────────────────────────────────────────── */
function ProjectEditor({ row, isNew, toast, onDone, onCancel }) {
  const [f, setF] = useState(row);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!!isNew);
  useEffect(() => { setF(row); }, [row]);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  async function pickImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { dataUrl } = await resizeImage(file, { maxWidth: 1400, maxHeight: 1000 });
      setF(s => ({ ...s, image_data: dataUrl, image_url: dataUrl }));
    } catch (ex) { toast(ex.message || 'Could not read that image', 'err'); }
  }

  async function save(overrides = {}) {
    const body = { ...f, ...overrides };
    if (!String(body.title || '').trim()) return toast('Give the project a title.', 'err');
    setBusy(true);
    const r = isNew ? await aPost('/api/admin/projects', body)
                    : await aPatch(`/api/admin/projects/${f.id}`, body);
    setBusy(false);
    if (!r?.ok) return toast(`${r?.message || 'Save failed'}${r?.hint ? ` — ${r.hint}` : ''}`, 'err');
    toast(r.message || 'Saved'); onDone();
  }

  async function remove() {
    if (!confirm(`Delete “${f.title}”? This cannot be undone.`)) return;
    setBusy(true);
    const r = await aDel(`/api/admin/projects/${f.id}`);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Project deleted'); onDone();
  }

  // Collapsed to one line by default, so a long scheme list stays readable.
  if (!isNew && !open) {
    return <Card>
      <div className="flex flex-wrap items-center gap-2">
        <button className="font-bold text-tnr-cream text-left" onClick={() => setOpen(true)}>
          {f.title || '(untitled)'}
        </button>
        <span className="text-[11px] text-tnr-cream/50">
          {[STATUS_LABEL[f.status], f.village || f.union_council,
            Number(f.approved_cost) > 0 ? money(f.approved_cost) : null].filter(Boolean).join(' · ')}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${f.published
          ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-tnr-cream/50'}`}>
          {f.published ? 'Published' : 'Draft'}
        </span>
        <button className="btn-ghost !py-1 !px-3 text-xs ml-auto" onClick={() => setOpen(true)}>Edit</button>
      </div>
    </Card>;
  }

  return <Card>
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="font-black text-tnr-cream">{isNew ? 'New project' : (f.title || '(untitled)')}</h3>
      {!isNew && <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setOpen(false)}>Collapse</button>}
    </div>

    <Field label="Project / scheme title"><input className="input" value={f.title || ''} onChange={set('title')} /></Field>

    <div className="grid sm:grid-cols-3 gap-3">
      <Field label="Scheme number"><input className="input" value={f.scheme_no || ''} onChange={set('scheme_no')} placeholder="Optional" /></Field>
      <Field label="Department"><input className="input" value={f.department || ''} onChange={set('department')} placeholder="Works / Education / Health" /></Field>
      <Field label="Stage">
        <select className="input" value={f.status} onChange={set('status')}>
          {PROJECT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Sector">
        <input className="input" list="tnr-project-categories" value={f.category || ''} onChange={set('category')} />
        <datalist id="tnr-project-categories">
          {PROJECT_CATEGORIES.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>
    </div>

    {/* Areas come from the managed list, not free text — otherwise "Hardass"
        and "HARDASS" split one village across two rows of the public table. */}
    <AreaSelect council={f.union_council} village={f.village}
      onChange={(patch) => setF(s => ({ ...s, ...patch }))} />

    {/* ── Money ── */}
    <div className="rounded-xl border border-tnr-line/60 p-3 mb-3">
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Cost</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Approved cost"><input className="input" value={f.approved_cost ?? ''} onChange={set('approved_cost')} placeholder="0" /></Field>
        <Field label="Funds released"><input className="input" value={f.released_funds ?? ''} onChange={set('released_funds')} placeholder="0" /></Field>
        <Field label="Funds utilised"><input className="input" value={f.utilised_funds ?? ''} onChange={set('utilised_funds')} placeholder="0" /></Field>
      </div>
      <p className="text-[11px] text-tnr-cream/40">
        Whole rupees. Commas are fine — “12,500,000” is read as 12500000. Leave a
        figure at 0 if it has not been notified; the public page hides zeros
        rather than showing “Rs 0”.
      </p>
    </div>

    {/* ── Dates and progress ── */}
    <div className="rounded-xl border border-tnr-line/60 p-3 mb-3">
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Timeline</div>
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Approved on"><input type="date" className="input" value={f.approved_date || ''} onChange={set('approved_date')} /></Field>
        <Field label="Work started"><input type="date" className="input" value={f.start_date || ''} onChange={set('start_date')} /></Field>
        <Field label="Target completion"><input type="date" className="input" value={f.target_date || ''} onChange={set('target_date')} /></Field>
        <Field label="Completed on"><input type="date" className="input" value={f.completion_date || ''} onChange={set('completion_date')} /></Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Physical progress %"><input type="number" min="0" max="100" className="input" value={f.progress_percent ?? 0} onChange={set('progress_percent')} /></Field>
        <Field label="Year"><input type="number" className="input" value={f.year ?? ''} onChange={set('year')} /></Field>
        <Field label="People served"><input type="number" min="0" className="input" value={f.beneficiaries ?? 0} onChange={set('beneficiaries')} /></Field>
      </div>
    </div>

    <Field label="Summary">
      <textarea className="input min-h-[70px]" value={f.summary || ''} onChange={set('summary')}
        placeholder="One or two sentences about the scheme." />
    </Field>
    <Field label="Contractor (optional)"><input className="input" value={f.contractor || ''} onChange={set('contractor')} /></Field>

    {/* ── Provenance ── */}
    <div className="rounded-xl border p-3 mb-3" style={{ borderColor: 'rgba(200,154,43,.4)' }}>
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Where this information came from</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Source"><input className="input" value={f.source || ''} onChange={set('source')}
          placeholder="e.g. P&amp;D Department notification, 12 Mar 2026" /></Field>
        <Field label="Last verified"><input type="date" className="input" value={f.last_verified || ''} onChange={set('last_verified')} /></Field>
      </div>
      <p className="text-[11px] text-tnr-cream/50">
        Both are shown publicly with the project. Fill them in before publishing —
        a spending figure with no source is the one that gets challenged.
      </p>
    </div>

    <span className="label">Cover photo <span className="text-tnr-cream/40">(optional)</span></span>
    <div className="flex items-center gap-3 mt-1 mb-4">
      {f.image_url
        ? <img src={f.image_url} alt="" className="h-16 w-28 rounded-lg object-cover" />
        : <div className="h-16 w-28 rounded-lg bg-white/10 grid place-items-center text-[10px] text-tnr-cream/50">None</div>}
      <input type="file" accept="image/*" onChange={pickImage} className="text-xs text-tnr-cream/70" />
    </div>

    <GalleryPicker f={f} setF={setF} toast={toast} />

    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" disabled={busy} onClick={() => save()}>
        {busy ? 'Saving…' : (isNew ? 'Add project' : 'Save')}
      </button>
      {isNew
        ? <button className="btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        : <>
            <button className="btn-ghost" disabled={busy} onClick={() => save({ published: !f.published })}>
              {f.published ? 'Unpublish' : 'Publish'}
            </button>
            <input type="number" className="input !w-24" value={f.sort_order ?? 0}
              onChange={set('sort_order')} title="Order — lower shows first" />
            <button className="btn-ghost !text-red-300 ml-auto" disabled={busy} onClick={remove}>Delete</button>
          </>}
    </div>
  </Card>;
}
