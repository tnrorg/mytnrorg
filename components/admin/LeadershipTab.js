'use client';
import { useCallback, useEffect, useState } from 'react';
import AssignLeader from './AssignLeader';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Badge, Field } from './ui';

const BODIES = [
  ['advisory',  'Advisory Council'],
  ['executive', 'Executive Committee'],
];

const empty = {
  name: '', designation: '', qualification: '', field: '', affiliation: '', summary: '',
  expertise: '', duties: '', slug: '', sort_order: 0, active: true, photo_data: null, photo_url: '',
};

const asText = (v) => Array.isArray(v) ? v.join('\n') : (v || '');

export default function LeadershipTab({ toast }) {
  const [body, setBody] = useState('advisory');
  const [all, setAll] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    // Fetch ALL bodies, then filter locally. The counts on the switcher then
    // reveal at a glance if a profile was saved under the wrong tab — the
    // failure mode that makes a saved profile look missing on the website.
    const r = await aGet('/api/admin/leadership');
    setLoading(false);
    if (!r?.ok) { setErr(r?.message || 'Could not load profiles.'); setRows([]); setAll([]); return; }
    const profiles = r.profiles || [];
    setAll(profiles);
    setRows(profiles.filter(p => p.body === body));
  }, [body]);
  useEffect(() => { load(); }, [load]);

  function pickPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast('Photo must be under 4 MB', 'err');
    const rd = new FileReader();
    rd.onload = () => setForm(s => ({ ...s, photo_data: rd.result, photo_url: rd.result }));
    rd.readAsDataURL(f);
  }

  function edit(p) {
    setForm({
      ...p,
      expertise: asText(p.expertise), duties: asText(p.duties),
      // The new array fields need the same textarea treatment, or editing a
      // profile would wipe the skills and research areas already saved.
      skills: asText(p.skills), research_areas: asText(p.research_areas),
      photo_data: null,
    });
  }

  async function save() {
    if (!form.name?.trim() && !form.designation?.trim())
      return toast('Enter a name or a designation', 'err');
    const payload = { ...form, body };
    const r = form.id
      ? await aPatch('/api/admin/leadership/' + form.id, payload)
      : await aPost('/api/admin/leadership', payload);
    if (!r?.ok) return toast(r?.message || 'Save failed', 'err');
    toast(form.id ? 'Profile updated' : 'Profile added');
    setForm(null); load();
  }

  /** Moves a profile to the other body. Added because a profile saved under
   *  the wrong tab previously had to be deleted and retyped. */
  async function move(p) {
    const to = p.body === 'advisory' ? 'executive' : 'advisory';
    const label = to === 'advisory' ? 'Advisory Council' : 'Executive Committee';
    if (!confirm(`Move ${p.name || p.designation} to the ${label}?`)) return;
    const r = await aPatch('/api/admin/leadership/' + p.id, { body: to });
    if (!r?.ok) return toast(r?.message || 'Could not move', 'err');
    toast('Moved to ' + label); load();
  }

  async function del(p) {
    if (!confirm(`Remove ${p.name || p.designation} from the ${body === 'advisory' ? 'Advisory Council' : 'Executive Committee'}?`)) return;
    const r = await aDel('/api/admin/leadership/' + p.id);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Removed'); load();
  }

  async function toggle(p) {
    const r = await aPatch('/api/admin/leadership/' + p.id, { active: !p.active });
    if (!r?.ok) return toast(r?.message || 'Update failed', 'err');
    load();
  }

  const isExec = body === 'executive';

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 p-1 rounded-xl bg-white/5">
        {BODIES.map(([k, label]) => {
          const n = all.filter(p => p.body === k).length;
          const live = all.filter(p => p.body === k && p.active).length;
          return (
            <button key={k} onClick={() => { setBody(k); setForm(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition
                ${body === k ? 'bg-tnr-gold text-tnr-black font-semibold' : 'text-tnr-cream/70 hover:bg-white/5'}`}>
              {label} <span className="opacity-70">({live}/{n})</span>
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <button className="btn-green" onClick={() => { setAssigning(a => !a); setForm(null); }}>
        {assigning ? 'Close' : '+ Assign Member'}
      </button>
      <button className="btn-ghost" onClick={() => { setForm({ ...empty, sort_order: rows.length }); setAssigning(false); }}>
        + Add Profile
      </button>
    </div>

    {assigning && (
      <AssignLeader body={body} toast={toast} onDone={() => { setAssigning(false); load(); }}
        bodyLabel={body === 'advisory' ? 'Advisory Council' : 'Executive Committee'} />
    )}

    <p className="text-sm text-tnr-cream/60">
      These profiles appear on the homepage and under About TNR. Lower order number appears first.
      Leave the name blank to show “To Be Announced”.
    </p>

    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}
    {loading && <Card><div className="text-sm text-tnr-cream/60">Loading profiles…</div></Card>}
    {!loading && !err && !rows.length && (
      <Card><div className="text-sm text-tnr-cream/60">
        No profiles yet. Click “Add Profile” to create the first one.
      </div></Card>
    )}

    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(p => (
        <Card key={p.id}>
          <div className="flex gap-3">
            {p.photo_url
              ? <img src={p.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover object-top shrink-0" />
              : <div className="w-16 h-16 rounded-xl bg-white/10 grid place-items-center text-xs text-tnr-cream/50 shrink-0">No photo</div>}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-tnr-cream truncate">{p.name || 'To Be Announced'}</div>
              {p.designation && <div className="text-xs text-tnr-gold truncate">{p.designation}</div>}
              {p.qualification && <div className="text-xs text-tnr-cream/60 truncate">{p.qualification}{p.field ? ` (${p.field})` : ''}</div>}
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={p.active ? 'ok' : 'muted'}>{p.active ? 'Visible' : 'Hidden'}</Badge>
                {!p.active && (
                  <span className="text-[11px] text-amber-300">Not shown on the website</span>
                )}
                <span className="text-[11px] text-tnr-cream/40">#{p.sort_order}</span>
              </div>
            </div>
          </div>
          {p.affiliation && <div className="mt-2 text-xs text-tnr-cream/50 line-clamp-2">{p.affiliation}</div>}
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost !py-1.5 text-xs flex-1" onClick={() => edit(p)}>Edit</button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => toggle(p)}>{p.active ? 'Hide' : 'Show'}</button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => move(p)}>
              Move to {body === 'advisory' ? 'CEC' : 'Advisory'}
            </button>
            <button className="btn-ghost !py-1.5 text-xs text-red-300" onClick={() => del(p)}>Delete</button>
          </div>
        </Card>
      ))}
    </div>

    {form && (
      <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto p-4" onClick={e => e.target === e.currentTarget && setForm(null)}>
        <div className="max-w-2xl mx-auto my-6 rounded-2xl bg-tnr-black border border-tnr-line p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-tnr-cream">
              {form.id ? 'Edit Profile' : 'Add Profile'} — {isExec ? 'Executive Committee' : 'Advisory Council'}
            </h3>
            <button className="text-tnr-cream/50 hover:text-tnr-cream" onClick={() => setForm(null)}>✕</button>
          </div>

          <div className="flex items-center gap-4">
            {form.photo_url
              ? <img src={form.photo_url} alt="" className="w-24 h-24 rounded-xl object-cover object-top" />
              : <div className="w-24 h-24 rounded-xl bg-white/10 grid place-items-center text-xs text-tnr-cream/50">No photo</div>}
            <div>
              <input type="file" accept="image/*" onChange={pickPhoto} className="text-xs text-tnr-cream/70" />
              <p className="text-[11px] text-tnr-cream/40 mt-1">Square photo, at least 600×600. Max 4 MB.</p>
              {form.photo_url && (
                <button className="btn-ghost !py-1 text-[11px] mt-2"
                  onClick={() => setForm(s => ({ ...s, photo_url: '', photo_data: null }))}>Remove photo</button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Full Name">
              <input className="input" value={form.name || ''} placeholder="Leave blank for “To Be Announced”"
                onChange={e => setForm(s => ({ ...s, name: e.target.value }))} />
            </Field>
            <Field label={isExec ? 'Designation (e.g. President)' : 'Designation (optional)'}>
              <input className="input" value={form.designation || ''}
                onChange={e => setForm(s => ({ ...s, designation: e.target.value }))} />
            </Field>
            <Field label="Qualification — e.g. BS Software Engineering, MS Chemistry">
              <input className="input" value={form.qualification || ''}
                onChange={e => setForm(s => ({ ...s, qualification: e.target.value }))} />
            </Field>
            <Field label="Field / Subject">
              <input className="input" value={form.field || ''} placeholder="Climate & Energy Policy"
                onChange={e => setForm(s => ({ ...s, field: e.target.value }))} />
            </Field>
          </div>

          <Field label="Affiliation (university, employer, organisation)">
            <input className="input" value={form.affiliation || ''}
              onChange={e => setForm(s => ({ ...s, affiliation: e.target.value }))} />
          </Field>

            <Field label="Current Profession">
              <input className="input" value={form.profession || ''} placeholder="e.g. Consultant Physician"
                onChange={e => setForm(s => ({ ...s, profession: e.target.value }))} />
            </Field>
            <Field label="Organisation / University">
              <input className="input" value={form.organisation || ''} placeholder="e.g. Aga Khan University"
                onChange={e => setForm(s => ({ ...s, organisation: e.target.value }))} />
            </Field>
            <Field label="Country">
              <input className="input" value={form.country || ''} placeholder="e.g. Pakistan"
                onChange={e => setForm(s => ({ ...s, country: e.target.value }))} />
            </Field>
            <Field label="Professional Tagline">
              <input className="input" value={form.tagline || ''} placeholder="One line shown under the name"
                onChange={e => setForm(s => ({ ...s, tagline: e.target.value }))} />
            </Field>

          <Field label="Short Summary (one line, shown on the card)">
            <input className="input" value={form.summary || ''}
              onChange={e => setForm(s => ({ ...s, summary: e.target.value }))} />
          </Field>

          <Field label="Interests / Expertise — one per line">
            <textarea className="input min-h-[90px]" value={form.expertise || ''}
              placeholder={'Climate Policy\nEnergy Transition\nPublic Policy'}
              onChange={e => setForm(s => ({ ...s, expertise: e.target.value }))} />
          </Field>

          <Field label="Responsibilities — one per line (shown on the detail page)">
            <textarea className="input min-h-[90px]" value={form.duties || ''}
              onChange={e => setForm(s => ({ ...s, duties: e.target.value }))} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-3">
              <Field label="Card Introduction (2–3 lines, shown on the roster card)">
                <textarea className="input min-h-[70px]" value={form.intro || ''}
                  onChange={e => setForm(s => ({ ...s, intro: e.target.value }))} />
              </Field>
              <Field label="Full Biography (shown in the About section of the profile)">
                <textarea className="input min-h-[140px]" value={form.bio || ''}
                  placeholder="Background, professional journey, vision, community contribution and leadership experience."
                  onChange={e => setForm(s => ({ ...s, bio: e.target.value }))} />
              </Field>
              <Field label="Professional Skills — one per line">
                <textarea className="input min-h-[80px]" value={form.skills || ''}
                  placeholder={'Leadership\nResearch\nPublic Speaking'}
                  onChange={e => setForm(s => ({ ...s, skills: e.target.value }))} />
              </Field>
              <Field label="Research Areas — one per line">
                <textarea className="input min-h-[70px]" value={form.research_areas || ''}
                  onChange={e => setForm(s => ({ ...s, research_areas: e.target.value }))} />
              </Field>
            </div>

            <Field label="Email (private unless published below)">
              <input className="input" value={form.email || ''} type="email"
                onChange={e => setForm(s => ({ ...s, email: e.target.value }))} />
            </Field>
            <Field label="Mobile (private unless published below)">
              <input className="input" value={form.mobile || ''}
                onChange={e => setForm(s => ({ ...s, mobile: e.target.value }))} />
            </Field>

            <div className="sm:col-span-2 rounded-xl p-4 space-y-2" style={{ background: 'rgba(3,26,18,.35)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-tnr-cream/60">
                Public visibility
              </div>
              {[['show_email', 'Show email publicly on the profile'],
                ['show_mobile', 'Show mobile number publicly on the profile'],
                ['verified', 'Show the Verified badge'],
                ['accepts_guidance', 'Accept guidance requests from members'],
                ['cv_approved', 'Publish the uploaded CV']].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2.5 text-sm text-tnr-cream/85 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4"
                    checked={k === 'accepts_guidance' ? form[k] !== false : form[k] === true}
                    onChange={e => setForm(s => ({ ...s, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
              <p className="text-[11px] text-tnr-cream/40 pt-1">
                Contact details stay hidden unless ticked here. When hidden they are not sent to the
                browser at all, so they cannot be read from the page source.
              </p>
            </div>

            <Field label="URL Name (leave blank to generate)">
              <input className="input" value={form.slug || ''} placeholder="ali-shahid"
                onChange={e => setForm(s => ({ ...s, slug: e.target.value }))} />
            </Field>
            <Field label="Display Order">
              <input type="number" className="input" value={form.sort_order ?? 0}
                onChange={e => setForm(s => ({ ...s, sort_order: e.target.value }))} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-tnr-cream/70">
            <input type="checkbox" checked={form.active !== false}
              onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} />
            Show on the public website
          </label>

          <div className="flex gap-2 pt-1">
            <button className="btn-green flex-1" onClick={save}>{form.id ? 'Save Changes' : 'Add Profile'}</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
