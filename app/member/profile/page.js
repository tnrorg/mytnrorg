'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPatch, mPost } from '@/components/member/memberApi';
import AddressSelect from '@/components/membership/AddressSelect';
import { PROFESSIONS } from '@/lib/membership/options';
import { MIN_AGE, MAX_AGE } from '@/lib/membership/validateApplication';
import Link from 'next/link';
import { SOURCES, totalContributions } from '@/lib/contributions';

/** Earliest and latest date of birth the age limits allow. */
function dobBounds() {
  const t = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    min: iso(new Date(t.getFullYear() - MAX_AGE - 1, t.getMonth(), t.getDate() + 1)),
    max: iso(new Date(t.getFullYear() - MIN_AGE, t.getMonth(), t.getDate())),
  };
}
import Combobox from '@/components/ui/Combobox';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const base = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0B6B4F] bg-white text-[#15231D]';

// [key, label, fields:[name,label,type,width]]
const SECTIONS = [
  ['education', 'Education', [
    ['qualification', 'Qualification', 'text'], ['degree', 'Degree', 'text'],
    ['field_of_study', 'Field of Study', 'text'], ['institution', 'Institution', 'text'],
    ['start_date', 'Start Date', 'date'], ['end_date', 'End Date', 'date'],
    ['currently_studying', 'I am still studying here', 'checkbox'],
    ['grade', 'Grade / CGPA', 'text'], ['description', 'Description', 'textarea'],
  ]],
  ['experience', 'Work Experience', [
    ['job_title', 'Job Title', 'text'], ['organization', 'Organization', 'text'],
    ['employment_type', 'Employment Type', 'text'], ['location', 'Location', 'text'],
    ['start_date', 'Start Date', 'date'], ['end_date', 'End Date', 'date'],
    ['currently_working', 'I currently work here', 'checkbox'],
    ['responsibilities', 'Responsibilities', 'textarea'], ['achievements', 'Achievements', 'textarea'],
  ]],
  ['skills', 'Skills', [
    ['name', 'Skill', 'text'], ['category', 'Category', 'text'], ['level', 'Level', 'text'],
  ]],
  ['projects', 'Projects', [
    ['name', 'Project Name', 'text'], ['technologies', 'Technologies Used', 'text'],
    ['project_url', 'Project URL', 'text'], ['github_url', 'GitHub URL', 'text'],
    ['description', 'Description', 'textarea'],
  ]],
  ['certifications', 'Certifications', [
    ['name', 'Certificate Name', 'text'], ['issuer', 'Issuing Organization', 'text'],
    ['issue_date', 'Issue Date', 'date'], ['expiry_date', 'Expiry Date', 'date'],
    ['credential_id', 'Credential ID', 'text'], ['credential_url', 'Verification URL', 'text'],
  ]],
  ['languages', 'Languages', [
    ['language', 'Language', 'text'], ['proficiency', 'Proficiency', 'text'],
  ]],
  ['volunteer', 'Volunteer Experience', [
    ['role', 'Role', 'text'], ['organization', 'Organization', 'text'], ['area', 'Area', 'text'],
    ['start_date', 'Start Date', 'date'], ['end_date', 'End Date', 'date'],
    ['currently_active', 'I am still volunteering here', 'checkbox'],
    ['description', 'Description', 'textarea'],
  ]],
];

/* The three sections above each have a "still here" flag. Ticking it hides the
   end date and the entry reads "… → Present" everywhere it appears — the list,
   the CV and the public profile. Without it, someone in their current job had
   to either leave the end date blank (which read as unfinished) or type a
   future date (which was untrue). */
const CURRENT_FLAG = {
  education: 'currently_studying',
  experience: 'currently_working',
  volunteer: 'currently_active',
};

export default function ProfilePage() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => mGet('/api/member/profile').then(r => r.ok && setD(r));
  useEffect(() => { load(); }, []);

  if (!d) return <MemberShell active="/member/profile"><p className="text-gray-400">Loading…</p></MemberShell>;

  return (
    <MemberShell active="/member/profile">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">My Profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Keep your professional profile up to date — it powers your CV, cover letters and member directory listing.
      </p>
      {msg && <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#0B6B4F14', color: C.deep }}>{msg}</div>}

      {!!d.pending_requests?.length && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Awaiting committee approval: <b>{d.pending_requests.map(r => r.field.replace(/_/g, ' ')).join(', ')}</b>
        </div>
      )}

      <PhotoCard core={d.core} onSaved={m => { setMsg(m); load(); }} />
      <CoreCard core={d.core} onSaved={m => { setMsg(m); load(); }} />
      <AddressProfessionCard core={d.core} onSaved={m => { setMsg(m); load(); }} />
      <AboutCard profile={d.profile} onSaved={m => { setMsg(m); load(); }} />
      <ContributionCard />

      {SECTIONS.map(([key, label, fields]) => (
        <SectionCard key={key} sec={key} label={label} fields={fields} items={d[key] || []} reload={load} />
      ))}
    </MemberShell>
  );
}


/* ── Profile photo ── */
function PhotoCard({ core, onSaved }) {
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function pick(file) {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setErr('Use a JPG, PNG or WEBP image.');
    if (file.size > 8 * 1024 * 1024) return setErr('Choose an image smaller than 8 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        setPreview(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!preview) return;
    setBusy(true); setErr('');
    const r = await mPatch('/api/member/profile', { photo_data: preview });
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Could not save the photo.');
    setPreview('');
    window.dispatchEvent(new Event('tnr-member-updated'));   // refresh sidebar avatar
    onSaved('Profile photo updated.');
  }

  const shown = preview || core.photo_url;

  return (
    <Card title="Profile Photo" note="Your photo appears on your membership card, certificate and member directory listing.">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="w-28 h-32 rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 grid place-items-center shrink-0">
          {shown
            ? <img src={shown} alt="" className="w-full h-full object-cover" />
            : <span className="text-4xl text-gray-300">👤</span>}
        </div>
        <div className="min-w-0">
          <input type="file" accept="image/png,image/jpeg,image/webp"
            onChange={e => pick(e.target.files?.[0])}
            className="block w-full text-xs text-gray-600
              file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-xs file:font-bold file:text-white file:cursor-pointer
              file:bg-[#0B6B4F] hover:file:bg-[#063D2B]" />
          <p className="mt-1.5 text-[11px] text-gray-400">A clear passport-style photo. JPG, PNG or WEBP.</p>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          {preview && (
            <div className="mt-3 flex gap-2">
              <button onClick={save} disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                {busy ? 'Saving…' : 'Save Photo'}</button>
              <button onClick={() => setPreview('')} className="px-4 py-2 rounded-xl text-sm border border-gray-200">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Membership details: sensitive fields need approval ── */
function CoreCard({ core, onSaved }) {
  const [f, setF] = useState({
    first_name: core.first_name || '', last_name: core.last_name || '',
    email: core.email || '', mobile: core.mobile || '',
    village: core.village || '', union_council: core.union_council || '',
    // Sliced because Postgres returns a timestamp and <input type="date">
    // accepts only YYYY-MM-DD — the full string leaves the picker blank.
    date_of_birth: (core.date_of_birth || '').slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await mPatch('/api/member/profile', f);
    setBusy(false);
    if (r.ok) onSaved(r.message);
  };
  return (
    <Card title="Membership Details"
      note="Name, email, mobile and location are reviewed by the membership committee before they take effect. Date of birth is saved straight away.">
      <div className="grid sm:grid-cols-2 gap-3">
        <F l="Membership ID"><input value={core.membership_id} disabled className={base + ' opacity-60 font-mono'} /></F>
        <F l="Status"><input value={core.status} disabled className={base + ' opacity-60 uppercase'} /></F>
        {[['first_name', 'First Name'], ['last_name', 'Last Name'], ['email', 'Email'],
          ['mobile', 'Mobile'], ['village', 'Village'], ['union_council', 'Union Council']].map(([k, l]) => (
          <F key={k} l={`${l} — needs approval`}>
            <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className={base} />
          </F>
        ))}
        {/* Date of birth — editable, because the usual reason to change it is
            that it was mistyped at registration. min/max keep the picker
            inside TNR's age range; the API enforces the same limits, since
            these attributes are trivially bypassed. */}
        <F l={`Date of Birth (age ${MIN_AGE}–${MAX_AGE})`}>
          <input type="date" value={f.date_of_birth || ''}
            min={dobBounds().min} max={dobBounds().max}
            onChange={e => setF({ ...f, date_of_birth: e.target.value })}
            className={base} />
        </F>
      </div>
      <button onClick={save} disabled={busy} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
        style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
        {busy ? 'Submitting…' : 'Request Changes'}
      </button>
    </Card>
  );
}

/* ── Current address, profession and organisation ───────────────────────────
 * These questions were added to the application form after most members had
 * already been approved — including every CEC and Advisory Council member — so
 * their records have nothing in them. This card is the only route by which
 * those members can ever fill them in.
 *
 * Saves immediately, no committee approval: a city or an employer is not an
 * identity claim, and routing it through review would leave the fields empty
 * for weeks.
 */
function AddressProfessionCard({ core, onSaved }) {
  const [f, setF] = useState({
    current_country: core.current_country || '',
    current_country_code: core.current_country_code || '',
    current_state_province: core.current_state_province || '',
    current_state_code: core.current_state_code || '',
    current_city: core.current_city || '',
    profession: core.profession || '',
    profession_other: core.profession_other || '',
    organization_name: core.organization_name || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Same shape the application form's `set` uses, so AddressSelect can be
  // dropped in unchanged rather than forked for the portal.
  const set = (k, v) => {
    setErr('');
    setF(p => (k.startsWith('__') ? { ...p, ...v } : { ...p, [k]: v }));
  };

  const save = async () => {
    if (f.profession && !PROFESSIONS.includes(f.profession))
      return setErr('Please choose a profession from the list, or select Other.');
    if (f.profession === 'Other' && !f.profession_other.trim())
      return setErr('Please type your profession.');
    setBusy(true);
    const r = await mPatch('/api/member/profile', f);
    setBusy(false);
    if (r.ok) onSaved('Address and profession updated.');
    else setErr(r?.message || 'Could not save. Please try again.');
  };

  return (
    <Card title="Current Address & Profession"
      note="Where you live now and what you do. Saved immediately — no approval needed.">
      <AddressSelect f={f} set={set} blur={() => {}} showErr={() => ''}
        Field={PF} Select={PSelect} Input={PInput} />

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <PF label="Profession / Field">
          {/* Was <input list> + <datalist>, which iOS Safari never renders as a
              dropdown — the options landed in the keyboard suggestion bar
              instead, so on a phone this looked like an empty text field. */}
          <Combobox
            value={f.profession}
            options={PROFESSIONS}
            placeholder="Type to search…"
            onChange={v => set('__profession', {
              profession: v,
              ...(v === 'Other' ? {} : { profession_other: '' }),
            })} />
        </PF>
        {f.profession === 'Other' && (
          <PF label="Specify Profession">
            <input value={f.profession_other} className={base} placeholder="Enter your profession"
              onChange={e => set('profession_other', e.target.value)} />
          </PF>
        )}
        <PF label="Organisation / Institution">
          <input value={f.organization_name} className={base}
            onChange={e => set('organization_name', e.target.value)} />
        </PF>
      </div>

      {err && <p className="mt-2 text-[12px] font-semibold text-red-600">{err}</p>}
      <button onClick={save} disabled={busy}
        className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
        style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </Card>
  );
}

/* Adapters so AddressSelect renders with the PORTAL's field styling rather
   than the application form's. Same component, two skins — forking it would
   mean fixing every future cascade bug twice. */
const PF = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">{label}</span>
    {children}
  </label>
);
const PInput = ({ value, onChange, placeholder }) => (
  <input value={value || ''} placeholder={placeholder} className={base}
    onChange={e => onChange(e.target.value)} />
);
const PSelect = ({ value, onChange, options, placeholder, disabled }) => (
  <select value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value)}
    className={base + (disabled ? ' opacity-50 cursor-not-allowed' : '')}>
    <option value="">{placeholder || '— select —'}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

/* ── Free-to-edit professional info ── */
function AboutCard({ profile, onSaved }) {
  const KEYS = [['headline', 'Professional Headline', 'text'], ['summary', 'Professional Summary', 'textarea'],
    ['country', 'Current Country', 'text'], ['city', 'Current City', 'text'],
    ['whatsapp', 'WhatsApp Number', 'text'], ['address', 'Address', 'text'],
    ['linkedin_url', 'LinkedIn URL', 'text'], ['portfolio_url', 'Portfolio URL', 'text'],
    ['github_url', 'GitHub URL', 'text'], ['tnr_contributions', 'TNR Contributions', 'textarea'],
    ['awards', 'Awards & Achievements', 'textarea']];
  const [f, setF] = useState(Object.fromEntries(KEYS.map(([k]) => [k, profile[k] || ''])));
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const r = await mPatch('/api/member/profile', f); setBusy(false); if (r.ok) onSaved('Profile updated.'); };
  return (
    <Card title="Professional Information">
      <div className="grid sm:grid-cols-2 gap-3">
        {KEYS.map(([k, l, t]) => (
          <F key={k} l={l} full={t === 'textarea'}>
            {t === 'textarea'
              ? <textarea rows={3} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className={base} />
              : <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className={base} />}
          </F>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
        style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>{busy ? 'Saving…' : 'Save'}</button>
    </Card>
  );
}

/* ── Repeatable sections ── */
function SectionCard({ sec, label, fields, items, reload }) {
  const [adding, setAdding] = useState(false);
  // id of the entry being edited — the same form serves both, so there is one
  // set of inputs to maintain rather than two that can drift apart.
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  const openForm = ()      => { setEditingId(null); setF({}); setAdding(true); };
  const openEdit = (it)    => { setEditingId(it.id); setF({ ...it }); setAdding(true); };
  const closeForm = ()     => { setEditingId(null); setF({}); setAdding(false); };

  const save = async () => {
    setBusy(true);
    const r = editingId
      ? await mPatch(`/api/member/profile/${sec}`, { ...f, id: editingId })
      : await mPost(`/api/member/profile/${sec}`, f);
    setBusy(false);
    if (r.ok) { closeForm(); reload(); }
  };
  const del = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/member/profile/${sec}?id=${id}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('tnr_member_token') },
    });
    reload();
  };
  // Null for sections with no date range (skills, projects, languages…).
  const flagKey = CURRENT_FLAG[sec] || null;

  const title = (it) => it.name || it.job_title || it.qualification || it.degree || it.language || it.role || '—';
  const sub = (it) => [it.institution, it.organization, it.issuer, it.proficiency, it.level, it.area]
    .filter(Boolean).join(' · ');

  return (
    <Card title={label} action={<button onClick={() => (adding ? closeForm() : openForm())}
      className="text-xs font-bold" style={{ color: C.green }}>
      {adding ? 'Cancel' : '+ Add'}</button>}>
      {!items.length && !adding && <p className="text-sm text-gray-400">No entries yet.</p>}

      <div className="space-y-2">
        {items.map(it => (
          <div key={it.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: C.deep }}>{title(it)}</div>
              {sub(it) && <div className="text-xs text-gray-500">{sub(it)}</div>}
              {(it.start_date || it.end_date || (flagKey && it[flagKey])) && (
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {it.start_date || '—'} → {(flagKey && it[flagKey]) ? 'Present' : (it.end_date || 'Present')}
                </div>)}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => openEdit(it)}
                className="text-xs font-semibold hover:underline" style={{ color: C.green }}>Edit</button>
              <button onClick={() => del(it.id)}
                className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 rounded-xl bg-gray-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: C.deep }}>
            {editingId ? `Edit ${label.replace(/s$/, '')}` : `New ${label.replace(/s$/, '')}`}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {fields.map(([k, l, t]) => {
              if (t === 'checkbox') return (
                <label key={k} className="sm:col-span-2 flex items-center gap-2.5 text-sm cursor-pointer"
                  style={{ color: C.deep }}>
                  <input type="checkbox" checked={!!f[k]} className="w-4 h-4 accent-[#0B6B4F]"
                    // Ticking it clears any end date already typed, so the two
                    // can never disagree about whether the role has ended.
                    onChange={e => setF({ ...f, [k]: e.target.checked, ...(e.target.checked ? { end_date: '' } : {}) })} />
                  {l}
                </label>
              );
              const current = flagKey && f[flagKey] && k === 'end_date';
              return (
                <F key={k} l={current ? 'End Date (present)' : l} full={t === 'textarea'}>
                  {t === 'textarea'
                    ? <textarea rows={2} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} className={base} />
                    : <input type={t} value={current ? '' : (f[k] || '')} disabled={!!current}
                        placeholder={current ? 'Present' : undefined}
                        onChange={e => setF({ ...f, [k]: e.target.value })}
                        className={`${base} ${current ? 'opacity-50' : ''}`} />}
                </F>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
              {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Add Entry'}
            </button>
            <button onClick={closeForm} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── shared bits ── */
/* What this member has actually done for TNR, on their own profile.
 *
 * The profile already says who someone is — name, qualification, profession.
 * This says what they have contributed, which for a working office bearer is
 * the more useful half and was previously visible nowhere on this page.
 *
 * It loads SEPARATELY from the profile.
 *
 * The profile is the page a member opens most, and it must not sit blank
 * while a year of meetings, events and volunteering is aggregated across
 * eight tables. So the profile renders immediately and this card fills in
 * underneath — and if the aggregation fails outright, the card removes
 * itself rather than putting an error in the middle of somebody's profile.
 */
function ContributionCard() {
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    mGet(`/api/member/contributions?year=${year}`)
      .then(r => (r?.ok ? setD(r) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [year]);

  if (failed) return null;

  const rec = d?.record;
  const counts = {
    meetings: rec?.meetings?.attended || 0,
    events: rec?.events?.attended || 0,
    volunteering: rec?.volunteering?.assignments || 0,
    writing: (rec?.writing?.opinions || 0) + (rec?.writing?.comments || 0),
    activities: rec?.activities?.count || 0,
    leadership: (rec?.leadership?.hosted || 0) + (rec?.leadership?.duties || 0),
  };
  const total = totalContributions(rec);

  return (
    <Card title={`My contribution in ${year}`}
      note="Everything you have taken part in, kept up to date automatically."
      action={
        <Link href="/member/contributions"
          className="text-xs font-bold hover:underline" style={{ color: C.green }}>
          See the full record →
        </Link>
      }>
      {!d && <p className="text-sm text-gray-400">Loading your record…</p>}

      {d && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SOURCES.map(s => (
              <div key={s.key} className="rounded-xl border border-gray-100 bg-gray-50/70 px-2.5 py-2 text-center">
                <div className="text-base leading-none">{s.icon}</div>
                <div className="mt-1 text-xl font-black tabular-nums" style={{ color: C.deep }}>
                  {counts[s.key]}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* The honest empty state. A new member, or one whose work has not
              been logged yet, is not told they have contributed nothing —
              they are told where it comes from and what to do about it. */}
          {total === 0 ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">
              Nothing recorded for {year} yet. Meetings, events, volunteering and
              writing appear here on their own; work you do in Roundu is added by
              an office bearer, so tell your union council team about anything
              missing.
            </p>
          ) : (
            <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">
              <b className="text-gray-700">{total}</b> recorded contribution{total === 1 ? '' : 's'} this year
              {rec?.meetings?.invited
                ? `, including ${rec.meetings.attended} of ${rec.meetings.invited} meetings you were invited to` : ''}
              {rec?.volunteering?.hours ? `, and ${rec.volunteering.hours} volunteer hours` : ''}.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Card({ title, note, action, children }) {
  return <div className="mt-5 rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
    <div className="flex items-center justify-between">
      <h2 style={{ ...mont, color: C.deep }} className="text-sm font-black uppercase tracking-wide">{title}</h2>
      {action}
    </div>
    {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    <div className="mt-4">{children}</div>
  </div>;
}
const F = ({ l, full, children }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="block text-xs font-semibold text-gray-500 mb-1">{l}</label>{children}
  </div>
);
