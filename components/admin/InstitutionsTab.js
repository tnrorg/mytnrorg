'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Field } from './ui';
import AreaSelect from './AreaSelect';
import GalleryPicker from './GalleryPicker';
import {
  KINDS, LEVELS, SERVES, SECTORS, KIND_LABEL, LEVEL_LABEL,
  blankInstitution, teachersPresent, summarise,
} from '@/lib/institutions';
import { resizeImage } from '@/lib/imageResize';

/* Schools, colleges and training centres — the source for the public
 * Education Statistics page.
 *
 * The four staffing numbers are the point of the whole register, so the form
 * explains each one rather than assuming shared vocabulary: "posted here" and
 * "serving here" being different numbers is the finding, not a data entry
 * mistake.
 */
export default function InstitutionsTab({ toast }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/institutions');
    if (!r?.ok) {
      setErr(`${r?.message || 'Could not load institutions.'}${r?.hint ? ` — ${r.hint}` : ''}`);
      setRows([]); return;
    }
    setRows(r.institutions);
  }
  useEffect(() => { load(); }, []);

  if (!rows) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  const s = summarise(rows.filter(r => r.published));

  return <div className="space-y-4 max-w-4xl">
    <p className="text-sm text-tnr-cream/60">
      Institutions shown on the public Education Statistics page. Only published
      entries are counted there.
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    {!!rows.length && (
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          {[['Institutions', s.total], ['Teachers present', s.present],
            ['Serving elsewhere', s.servingElsewhere], ['Community', s.communityTeachers],
            ['Needed', s.teachersNeeded]].map(([l, v]) => (
            <div key={l}>
              <div className="text-xl font-black text-tnr-goldLight">{v.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{l}</div>
            </div>
          ))}
        </div>
      </Card>
    )}

    {rows.map(row => <Editor key={row.id} row={row} toast={toast} onDone={load} />)}

    {draft
      ? <Editor row={draft} isNew toast={toast}
          onDone={() => { setDraft(null); load(); }} onCancel={() => setDraft(null)} />
      : <button className="btn" onClick={() => setDraft(blankInstitution())}>+ Add school / college</button>}
  </div>;
}

function Editor({ row, isNew, toast, onDone, onCancel }) {
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
    if (!String(body.name || '').trim()) return toast('Enter the name of the institution.', 'err');
    setBusy(true);
    const r = isNew ? await aPost('/api/admin/institutions', body)
                    : await aPatch(`/api/admin/institutions/${f.id}`, body);
    setBusy(false);
    if (!r?.ok) return toast(`${r?.message || 'Save failed'}${r?.hint ? ` — ${r.hint}` : ''}`, 'err');
    toast(r.message || 'Saved'); onDone();
  }

  async function remove() {
    if (!confirm(`Delete “${f.name}”? This cannot be undone.`)) return;
    setBusy(true);
    const r = await aDel(`/api/admin/institutions/${f.id}`);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Deleted'); onDone();
  }

  const present = teachersPresent(f);
  // A school cannot have more teachers actually serving than are posted to it;
  // anyone attached in from elsewhere belongs in the next field along.
  const overServing = Number(f.serving_here) > Number(f.posted_here);

  if (!isNew && !open) {
    return <Card>
      <div className="flex flex-wrap items-center gap-2">
        <button className="font-bold text-tnr-cream text-left" onClick={() => setOpen(true)}>
          {f.name || '(unnamed)'}
        </button>
        <span className="text-[11px] text-tnr-cream/50">
          {[KIND_LABEL[f.kind], LEVEL_LABEL[f.level], f.village || f.union_council].filter(Boolean).join(' · ')}
        </span>
        <span className="text-[11px] text-tnr-cream/40">{present} teacher{present === 1 ? '' : 's'} present</span>
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
      <h3 className="font-black text-tnr-cream">{isNew ? 'New institution' : (f.name || '(unnamed)')}</h3>
      {!isNew && <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => setOpen(false)}>Collapse</button>}
    </div>

    <Field label="Name"><input className="input" value={f.name || ''} onChange={set('name')}
      placeholder="Government Boys High School Hardass" /></Field>

    <div className="grid sm:grid-cols-4 gap-3">
      <Field label="Type">
        <select className="input" value={f.kind} onChange={set('kind')}>
          {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Level">
        <select className="input" value={f.level} onChange={set('level')}>
          {LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Serves">
        <select className="input" value={f.serves} onChange={set('serves')}>
          {SERVES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Run by">
        <select className="input" value={f.sector} onChange={set('sector')}>
          {SECTORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
    </div>

    <AreaSelect council={f.union_council} village={f.village}
      onChange={(patch) => setF(s => ({ ...s, ...patch }))} />

    {/* ── Staffing ── */}
    <div className="rounded-xl border border-tnr-line/60 p-3 mb-3">
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Teaching staff</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Num label="Sanctioned posts" hint="Approved by the department" v={f.sanctioned_posts} on={set('sanctioned_posts')} />
        <Num label="Posted here" hint="First-appointment station is this school" v={f.posted_here} on={set('posted_here')} />
        <Num label="Serving here" hint="Of those posted, actually teaching here" v={f.serving_here} on={set('serving_here')} />
        <Num label="Serving elsewhere" hint="Posted here, on duty at another station or city" v={f.serving_elsewhere} on={set('serving_elsewhere')} />
        <Num label="Attached in" hint="Posted elsewhere, actually teaching here" v={f.attached_in} on={set('attached_in')} />
        <Num label="Community teachers" hint="Hired and paid by the local community" v={f.community_teachers} on={set('community_teachers')} />
        <Num label="Additional teachers needed" hint="Shortfall for this institution" v={f.teachers_needed} on={set('teachers_needed')} />
      </div>

      <div className="mt-2 text-[12px] text-tnr-cream/70">
        Teachers actually present: <b className="text-tnr-goldLight">{present}</b>
        <span className="text-tnr-cream/40"> (serving here + attached in + community)</span>
      </div>
      {overServing && (
        <p className="mt-1 text-[11px] text-amber-300">
          “Serving here” is higher than “posted here”. Teachers who came from another
          school belong in “Attached in”.
        </p>
      )}

      <label className="block mt-3">
        <span className="label !mb-0.5">Where the absent teachers are serving</span>
        <span className="block text-[10px] text-tnr-cream/40 mb-1 leading-snug">
          The school and city each teacher posted here is actually on duty at.
        </span>
        <textarea className="input min-h-[64px]" value={f.elsewhere_note || ''}
          onChange={set('elsewhere_note')}
          placeholder="e.g. 1 at GHS Skardu, 1 at GBHS Gilgit" />
      </label>
      <p className="text-[11px] text-tnr-cream/50">
        Record the <b>station</b>, not the person. Naming an individual teacher on a
        public page is a claim about them personally and carries a different kind of
        risk; the posting itself is the fact that matters, and anyone who needs the
        name can ask the department.
      </p>
    </div>

    {/* ── Fees ── */}
    <div className="rounded-xl border p-3 mb-3" style={{ borderColor: 'rgba(200,154,43,.4)' }}>
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Fee charged for community teachers</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Monthly fee per student"><input className="input" value={f.community_fee_monthly ?? 0}
          onChange={set('community_fee_monthly')} placeholder="0" /></Field>
        <Field label="Note (optional)"><input className="input" value={f.fee_note || ''} onChange={set('fee_note')}
          placeholder="e.g. Charged from class 6 upwards" /></Field>
      </div>
      <p className="text-[11px] text-tnr-cream/50">
        Leave at 0 where no fee is charged. Rupees per student per month.
      </p>
    </div>

    {/* ── Students ── */}
    <div className="grid sm:grid-cols-3 gap-3">
      <Num label="Students total" v={f.students_total} on={set('students_total')} />
      <Num label="Boys" v={f.students_boys} on={set('students_boys')} />
      <Num label="Girls" v={f.students_girls} on={set('students_girls')} />
    </div>

    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Head teacher / principal"><input className="input" value={f.head_teacher || ''} onChange={set('head_teacher')} /></Field>
      <Field label="Contact number (not published)"><input className="input" value={f.contact || ''} onChange={set('contact')} /></Field>
    </div>
    <p className="-mt-1 mb-3 text-[11px] text-tnr-cream/40">
      The contact number is for TNR’s records only — it is never sent to the public page.
    </p>

    <Field label="Notes">
      <textarea className="input min-h-[70px]" value={f.notes || ''} onChange={set('notes')}
        placeholder="Anything else worth publishing about this institution." />
    </Field>

    {/* ── Provenance ── */}
    <div className="rounded-xl border p-3 mb-3" style={{ borderColor: 'rgba(200,154,43,.4)' }}>
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Where this information came from</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Source"><input className="input" value={f.source || ''} onChange={set('source')}
          placeholder="e.g. Visit to the school, 14 Jul 2026 / Education Dept record" /></Field>
        <Field label="Last verified"><input type="date" className="input" value={f.last_verified || ''} onChange={set('last_verified')} /></Field>
      </div>
      <p className="text-[11px] text-tnr-cream/50">
        Both are shown publicly. Naming a real school’s staffing gap without saying
        where the figure came from is the claim that gets disputed.
      </p>
    </div>

    <span className="label">Cover photo <span className="text-tnr-cream/40">(optional)</span></span>
    <div className="flex items-center gap-3 mt-1 mb-4">
      {f.image_url
        ? <img src={f.image_url} alt="" className="h-16 w-28 rounded-lg object-cover" />
        : <div className="h-16 w-28 rounded-lg bg-white/10 grid place-items-center text-[10px] text-tnr-cream/50">None</div>}
      <input type="file" accept="image/*" onChange={pickImage} className="text-xs text-tnr-cream/70" />
    </div>

    <GalleryPicker f={f} setF={setF} toast={toast} label="School photo gallery" />

    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" disabled={busy} onClick={() => save()}>
        {busy ? 'Saving…' : (isNew ? 'Add institution' : 'Save')}
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

function Num({ label, hint, v, on }) {
  return (
    <label className="block mb-3">
      <span className="label !mb-0.5">{label}</span>
      {hint && <span className="block text-[10px] text-tnr-cream/40 mb-1 leading-snug">{hint}</span>}
      <input type="number" min="0" className="input" value={v ?? 0} onChange={on} />
    </label>
  );
}
