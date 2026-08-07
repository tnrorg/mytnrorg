'use client';
import { useEffect, useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import {
  GENDERS, EDUCATION_LEVELS, POSITIONS, PROFESSIONS, CONTRIBUTION_AREAS,
  LEADERSHIP_OPTIONS, DECLARATION_TEXT, DECLARATION_VERSION,
} from '@/lib/membership/options';
import {
  validateApplication, STEPS, stepErrors, isStepComplete, REQUIRED_LABELS, ageFrom,
  MIN_AGE, MAX_AGE, organisationLabel, needsOrganisation, organisationOptional,
} from '@/lib/membership/validateApplication';
import AddressSelect from '@/components/membership/AddressSelect';
import { ROLES, roleLabel as ROLE_LABEL } from '@/lib/membership/roles';
import Stepper from '@/components/membership/Stepper';
import { useApplicationDraft } from '@/components/membership/useApplicationDraft';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const BLANK = {
  applied_role: '',
  photo_data: '',
  first_name: '', last_name: '', gender: '', date_of_birth: '', village: '', union_council: '',
  mobile: '', email: '',
  current_country: '', current_country_code: '',
  current_state_province: '', current_state_code: '', current_city: '',
  education_level: '', current_position: '',
  position_other: '', organization_name: '',
  profession: '', profession_other: '',
  why_join: '', contribution_areas: [], leadership_view: '', leadership_note: '',
  youth_issues: '', declaration_accepted: false, whatsapp_opt_in: false,
};

/* Human-readable summary of one step, for the Review screen. Deliberately
   built from an explicit list rather than looping the form object, so an
   internal field can never leak onto the review page by accident. */
function reviewRows(f, key) {
  const yes = (b) => (b ? 'Yes' : 'No');
  if (key === 'R') return [['Membership type', ROLE_LABEL(f.applied_role)]];
  if (key === 'A') return [
    ['Full name', [f.first_name, f.last_name].filter(Boolean).join(' ')],
    ['Gender', f.gender],
    ['Date of birth', f.date_of_birth ? `${f.date_of_birth} (age ${ageFrom(f.date_of_birth) ?? '—'})` : ''],
    ['Mobile / WhatsApp', f.mobile], ['Email', f.email],
    ['Current address', [f.current_city, f.current_state_province, f.current_country]
      .filter(Boolean).join(', ')],
    ['Union Council', f.union_council], ['Village / Area', f.village],
    ['Profile photo', f.photo_data ? 'Attached' : 'Not attached'],
  ];
  if (key === 'B') return [
    ['Education', f.education_level],
    ['Profession / Field', f.profession === 'Other' ? f.profession_other : f.profession],
    ['Current position', f.current_position === 'Other' ? f.position_other : f.current_position],
    ...(needsOrganisation(f.current_position)
      ? [[organisationLabel(f.current_position), f.organization_name || '—']] : []),
  ];
  if (key === 'C') return [
    ['Why join TNR', f.why_join],
    ['Contribution areas', (f.contribution_areas || []).join(', ')],
    ['Leadership view', f.leadership_view],
    ['Explanation', f.leadership_note || '—'],
    ['Youth issues', f.youth_issues],
  ];
  if (key === 'D') return [
    ['Declaration accepted', yes(f.declaration_accepted)],
    ['Join WhatsApp group', yes(f.whatsapp_opt_in)],
  ];
  return [];
}

/** Earliest and latest date of birth the age limits allow. */
function dobBounds() {
  const t = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    min: iso(new Date(t.getFullYear() - MAX_AGE - 1, t.getMonth(), t.getDate() + 1)),
    max: iso(new Date(t.getFullYear() - MIN_AGE, t.getMonth(), t.getDate())),
  };
}

export default function ApplyPage() {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(0);
  const [councils, setCouncils] = useState(null);   // null = still loading
  const [touched, setTouched] = useState({});   // fields the applicant has visited
  const [tried, setTried] = useState(false);    // they have pressed Submit at least once
  // `set('__address', {...})` applies several address fields in ONE update.
  // Cascading resets (country clears state and city) have to land together —
  // as separate setF calls the intermediate render can submit a city that no
  // longer belongs to the selected country.
  const set = (k, v) => {
    setErr('');
    setF(p => (k.startsWith('__') ? { ...p, ...v } : { ...p, [k]: v }));
  };
  const blur = (k) => setTouched(t => ({ ...t, [k]: true }));

  // Admin-managed Union Councils and their villages.
  useEffect(() => {
    fetch('/api/public/areas', { cache: 'no-store' })
      .then(r => r.json()).then(j => setCouncils(j?.ok ? (j.councils || []) : []))
      .catch(() => setCouncils([]));
  }, []);

  // Picking a different council clears a village that no longer belongs to it.
  const setCouncil = (name) => setF(p => ({ ...p, union_council: name, village: '' }));
  const villagesFor = (name) => councils?.find(c => c.name === name)?.villages || [];
  const useAreaLists = !!councils?.length;

  const { status: draftStatus, clearDraft } = useApplicationDraft(f, setF, BLANK);
  const errors = validateApplication(f);
  const stepKey = STEPS[step].key;
  const onReview = stepKey === 'REVIEW';
  // An error is only shown once the applicant has left that field, or after
  // they try to submit — no wall of red before they have typed anything.
  const showErr = (k) => (tried || touched[k]) ? errors[k] : '';
  const missing = Object.keys(errors).length;
  // Read the chosen image as a base64 data URL, downscaled to keep it small.
  function pickPhoto(file) {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type))
      return setErr('Profile photo must be a JPG, PNG or WEBP image.');
    if (file.size > 8 * 1024 * 1024)
      return setErr('Please choose an image smaller than 8 MB.');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to max 600px on the long edge — keeps uploads fast.
        const max = 600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        set('photo_data', c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => setErr('That image could not be read. Please try another file.');
      img.src = reader.result;
    };
    reader.onerror = () => setErr('Could not read that file.');
    reader.readAsDataURL(file);
  }

  const toggleArea = (a) => setF(p => ({
    ...p, contribution_areas: p.contribution_areas.includes(a)
      ? p.contribution_areas.filter(x => x !== a) : [...p.contribution_areas, a],
  }));

  /** Advance only when the current step validates, so a problem is caught on
   *  the screen that caused it rather than at the very end. */
  function next() {
    setTried(true);
    const bad = stepErrors(f, stepKey);
    if (Object.keys(bad).length) {
      setErr(`Please complete this step — ${Object.keys(bad).length} field${Object.keys(bad).length === 1 ? '' : 's'} need attention.`);
      const el = document.querySelector('[data-invalid="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector('input,select,textarea,button')?.focus?.();
      return;
    }
    setErr(''); setTried(false);
    setStep(sx => Math.min(STEPS.length - 1, sx + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function back() {
    setErr(''); setTried(false);
    setStep(sx => Math.max(0, sx - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;                          // disables repeated clicks
    setTried(true);
    if (missing) {
      // Every incomplete field is now flagged; jump to the first one so the
      // applicant is never left guessing what is blocking submission.
      setErr(`Please complete all required fields — ${missing} still need${missing === 1 ? 's' : ''} attention (section ${incompleteSections(errors).join(', ')}).`);
      const el = document.querySelector('[data-invalid="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector('input,select,textarea,button')?.focus?.();
      return;
    }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/public/membership/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, declaration_version: DECLARATION_VERSION }),
      }).then(x => x.json());
      if (!r.ok) {
        setErr([r.message, r.detail].filter(Boolean).join(' — ') || 'Could not submit. Please try again.');
        setBusy(false); return;
      }
      clearDraft();
      setDone(r);
    } catch { setErr('Network error. Please try again.'); }
    setBusy(false);
  }

  if (done) return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />
      <section className="flex-1 grid place-items-center px-4 py-20">
        <div className="max-w-lg w-full text-center rounded-3xl bg-white border border-gray-100 shadow-xl p-8">
          <div className="w-16 h-16 mx-auto rounded-full grid place-items-center text-3xl" style={{ background: '#0B6B4F14' }}>✅</div>
          <h1 style={{ ...mont, color: C.deep }} className="mt-4 text-2xl font-black">Application Submitted</h1>
          <p className="mt-2 text-gray-500 text-sm">Thank you for applying to Tehreek-e-Naujawanan Roundu. Your application is now pending review.</p>
          <div className="mt-5 rounded-2xl p-4" style={{ background: '#0B6B4F0d' }}>
            <div className="text-[11px] uppercase tracking-wider text-gray-500">Reference Number</div>
            <div style={{ ...mont, color: C.deep }} className="text-xl font-black tracking-wide">{done.reference_no}</div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Save this reference number. You will need it with your email to check your application status.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a href="/membership/status" className="flex-1 py-3 rounded-xl font-bold text-white" style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Check Status</a>
            <a href="/" className="flex-1 py-3 rounded-xl font-bold border-2 border-[#063D2B]/15 text-[#063D2B]">Back to Home</a>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />
      <section className="max-w-3xl w-full mx-auto px-4 py-10">
        <h1 style={{ ...mont, color: C.deep }} className="text-3xl font-black">Membership Application</h1>
        <p className="mt-2 text-gray-500 text-sm">Join Tehreek-e-Naujawanan Roundu. All applications are reviewed by the membership committee.</p>

        <div className="mt-8 rounded-tnr-lg bg-white border border-gray-100 p-5 shadow-tnr-flat">
          <Stepper steps={STEPS} current={step}
            isComplete={(k) => isStepComplete(f, k)}
            onJump={(i) => { setErr(''); setTried(false); setStep(i); }} />
          <p className="mt-4 text-[13px] text-gray-500">{STEPS[step].blurb}</p>
          {draftStatus !== 'idle' && (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: '#647169' }} aria-live="polite">
              {draftStatus === 'restored'
                ? '↻ Unfinished application restored — continue where you left off.'
                : '✓ Draft saved on this device'}
            </p>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          {stepKey === 'R' && <Card title="How would you like to join?">
            <div data-invalid={showErr('applied_role') ? 'true' : undefined} className="space-y-2.5">
              {ROLES.map(r => {
                const on = f.applied_role === r.key;
                return (
                  <label key={r.key}
                    className={`flex gap-3 items-start rounded-xl border p-4 cursor-pointer transition-colors duration-micro
                      ${on ? 'border-[#176B49] bg-[rgba(23,107,73,.05)]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="applied_role" value={r.key} checked={on}
                      onChange={() => { set('applied_role', r.key); blur('applied_role'); }}
                      className="mt-1 w-4 h-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-bold text-sm" style={{ color: C.deep }}>{r.label}</span>
                      <span className="block text-[12.5px] text-gray-500 mt-0.5 leading-snug">{r.blurb}</span>
                      <span className="block text-[11px] mt-1.5 font-semibold" style={{ color: C.green }}>
                        After approval: {r.portal}
                      </span>
                    </span>
                  </label>
                );
              })}
              {showErr('applied_role') &&
                <p className="text-[11px] font-semibold text-red-600">{showErr('applied_role')}</p>}
            </div>
            <p className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
              style={{ background: 'rgba(200,154,43,.10)', color: '#7A5C10' }}>
              <b>Please note:</b> select Union Council Team, Central Executive Committee or
              Advisory Council <b>only if you already hold that position</b>. If you do not,
              please select General Member. Thank you.
            </p>
          </Card>}

          {stepKey === 'A' && <Card title="Personal Information">
            <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-100"
              data-invalid={showErr('photo_data') ? 'true' : undefined}>
              <div className="w-24 h-28 rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 grid place-items-center shrink-0">
                {f.photo_data
                  ? <img src={f.photo_data} alt="Selected photo" className="w-full h-full object-cover" />
                  : <span className="text-3xl text-gray-300">👤</span>}
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Profile Photo<span className="text-red-500"> *</span>
                </label>
                <input type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={e => pickPhoto(e.target.files?.[0])}
                  className="block w-full text-xs text-gray-600
                    file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                    file:text-xs file:font-bold file:text-white file:cursor-pointer
                    file:bg-[#0B6B4F] hover:file:bg-[#063D2B]" />
                <p className="mt-1.5 text-[11px] text-gray-400">
                  A clear passport-style photo. JPG, PNG or WEBP. This appears on your membership card.
                </p>
                {showErr('photo_data') && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">{showErr('photo_data')}</p>
                )}
                {f.photo_data && (
                  <button type="button" onClick={() => set('photo_data', '')}
                    className="mt-1 text-[11px] font-semibold text-red-500 hover:underline">Remove photo</button>
                )}
              </div>
            </div>
            <SubHeading>Basic Information</SubHeading>
            <Grid>
              <Field label="First Name" req error={showErr('first_name')}><Input value={f.first_name} onChange={v => set('first_name', v)} onBlur={() => blur('first_name')} bad={!!showErr('first_name')} /></Field>
              <Field label="Last Name" req error={showErr('last_name')}><Input value={f.last_name} onChange={v => set('last_name', v)} onBlur={() => blur('last_name')} bad={!!showErr('last_name')} /></Field>
              <Field label="Gender" req error={showErr('gender')}><Select value={f.gender} onChange={v => set('gender', v)} options={GENDERS} onBlur={() => blur('gender')} bad={!!showErr('gender')} /></Field>
              {/* min/max bound the picker itself, so an out-of-range date
                  cannot be chosen — the validator still checks, since these
                  attributes are trivially bypassed. */}
              <Field label={`Date of Birth (age ${MIN_AGE}–${MAX_AGE})`} req error={showErr('date_of_birth')}>
                <Input type="date" value={f.date_of_birth} onChange={v => set('date_of_birth', v)}
                  min={dobBounds().min} max={dobBounds().max}
                  onBlur={() => blur('date_of_birth')} bad={!!showErr('date_of_birth')} />
              </Field>
              <Field label="Mobile / WhatsApp Number" req error={showErr('mobile')}><Input value={f.mobile} onChange={v => set('mobile', v)} placeholder="+92 3xx xxxxxxx" onBlur={() => blur('mobile')} bad={!!showErr('mobile')} /></Field>
              <Field label="Email Address" req error={showErr('email')}><Input type="email" value={f.email} onChange={v => set('email', v)} placeholder="name@example.com" onBlur={() => blur('email')} bad={!!showErr('email')} /></Field>
            </Grid>

            {/* Where the applicant lives now — members are all over the world,
                which is why this is separate from their home Union Council. */}
            <SubHeading>Current Address</SubHeading>
            <AddressSelect f={f} set={set} blur={blur} showErr={showErr}
              Field={Field} Select={Select} Input={Input} />

            {/* Home area in Roundu. Kept even for overseas members: it is what
                the village and Union Council statistics are built from. */}
            <SubHeading>Permanent Address — Roundu</SubHeading>
            <Grid>
              <Field label="Union Council in Roundu" req error={showErr('union_council')}>
                {useAreaLists
                  ? <Select value={f.union_council} onChange={setCouncil} options={councils.map(c => c.name)}
                      onBlur={() => blur('union_council')} bad={!!showErr('union_council')} />
                  : <Input value={f.union_council} onChange={v => set('union_council', v)} placeholder="e.g. Roundu"
                      onBlur={() => blur('union_council')} bad={!!showErr('union_council')} />}
              </Field>
              <Field label="Village / Area" req error={showErr('village')}>
                {useAreaLists
                  ? <Select value={f.village} onChange={v => set('village', v)}
                      options={villagesFor(f.union_council)}
                      placeholder={f.union_council ? '— select —' : '— choose a union council first —'}
                      disabled={!f.union_council}
                      onBlur={() => blur('village')} bad={!!showErr('village')} />
                  : <Input value={f.village} onChange={v => set('village', v)}
                      onBlur={() => blur('village')} bad={!!showErr('village')} />}
              </Field>
            </Grid>
          </Card>}

          {stepKey === 'B' && <Card title="Education & Profession">
            <Grid>
              <Field label="Highest Level of Education" req error={showErr('education_level')}><Select value={f.education_level} onChange={v => set('education_level', v)} options={EDUCATION_LEVELS} onBlur={() => blur('education_level')} bad={!!showErr('education_level')} /></Field>
              <Field label="Current Position" req error={showErr('current_position')}>
                <Select value={f.current_position} onChange={v => set('current_position', v)} options={POSITIONS}
                  onBlur={() => blur('current_position')} bad={!!showErr('current_position')} />
              </Field>
              {/* One database column, `organization_name`, with a label that
                  follows the chosen position — and hidden entirely for
                  positions that have no organisation to name. */}
              {needsOrganisation(f.current_position) && (
                <Field label={organisationLabel(f.current_position)}
                  req={!organisationOptional(f.current_position)}
                  error={showErr('organization_name')}>
                  <Input value={f.organization_name} onChange={v => set('organization_name', v)}
                    onBlur={() => blur('organization_name')} bad={!!showErr('organization_name')} />
                </Field>
              )}
              {f.current_position === 'Other' && (
                <Field label="Please specify your position" req error={showErr('position_other')}>
                  <Input value={f.position_other} onChange={v => set('position_other', v)}
                    placeholder="Type your current position"
                    onBlur={() => blur('position_other')} bad={!!showErr('position_other')} />
                </Field>
              )}
              <Field label="Profession / Field" req error={showErr('profession')}>
                <Combo value={f.profession} options={PROFESSIONS} listId="tnr-professions"
                  placeholder="Type to search…"
                  onChange={v => set('__profession', {
                    profession: v,
                    // Moving off "Other" drops the custom text, so a stale
                    // answer cannot be submitted alongside a real category.
                    ...(v === 'Other' ? {} : { profession_other: '' }),
                  })}
                  onBlur={() => blur('profession')} bad={!!showErr('profession')} />
              </Field>
              {f.profession === 'Other' && (
                <Field label="Specify Profession" req error={showErr('profession_other')}>
                  <Input value={f.profession_other} onChange={v => set('profession_other', v)}
                    placeholder="Enter your profession"
                    onBlur={() => blur('profession_other')} bad={!!showErr('profession_other')} />
                </Field>
              )}
            </Grid>
          </Card>}

          {stepKey === 'C' && <Card title="Motivation & Contribution">
            <Field label="Why do you want to join تحریک نوجوانان روندو؟" req error={showErr('why_join')}>
              <Textarea value={f.why_join} onChange={v => set('why_join', v)} rows={4}
                onBlur={() => blur('why_join')} bad={!!showErr('why_join')} />
            </Field>
            <Field label="Which areas are you most interested in contributing to?" req error={showErr('contribution_areas')}>
              <div className="flex flex-wrap gap-2 mt-1">
                {CONTRIBUTION_AREAS.map(a => {
                  const on = f.contribution_areas.includes(a);
                  return <button type="button" key={a} onClick={() => toggleArea(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${on
                      ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0B6B4F]'}`}
                    style={on ? { background: C.green } : {}}>{a}</button>;
                })}
              </div>
            </Field>
            <Field label="Do you believe educated and visionary leadership is important for the future of Roundu?" req error={showErr('leadership_view')}>
              <div className="flex gap-2 mt-1">
                {LEADERSHIP_OPTIONS.map(o => (
                  <button type="button" key={o} onClick={() => set('leadership_view', o)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${f.leadership_view === o
                      ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                    style={f.leadership_view === o ? { background: C.green } : {}}>{o}</button>
                ))}
              </div>
            </Field>
            <Field label="Would you like to explain your answer? (optional)">
              <Textarea value={f.leadership_note} onChange={v => set('leadership_note', v)} rows={2} />
            </Field>
            <Field label="What are the biggest issues facing the youth of Roundu today?" req error={showErr('youth_issues')}>
              <Textarea value={f.youth_issues} onChange={v => set('youth_issues', v)} rows={4}
                onBlur={() => blur('youth_issues')} bad={!!showErr('youth_issues')} />
            </Field>
          </Card>}

          {stepKey === 'D' && <Card title="Declaration">
            <div data-invalid={showErr('declaration_accepted') ? 'true' : undefined}>
            <label className="flex gap-3 items-start cursor-pointer">
              <input type="checkbox" checked={f.declaration_accepted} className="mt-1 w-4 h-4 shrink-0"
                onChange={e => set('declaration_accepted', e.target.checked)} />
              <span className="text-sm text-gray-600 leading-relaxed">{DECLARATION_TEXT}</span>
            </label>
            {showErr('declaration_accepted') &&
              <p className="mt-2 text-[11px] font-semibold text-red-600">{showErr('declaration_accepted')}</p>}
            </div>
          </Card>}

          {stepKey === 'D' && <Card title="WhatsApp Group (optional)">
            <label className="flex gap-3 items-center cursor-pointer">
              <input type="checkbox" checked={f.whatsapp_opt_in} className="w-4 h-4 shrink-0"
                onChange={e => set('whatsapp_opt_in', e.target.checked)} />
              <span className="text-sm text-gray-600">
                I would like to join the official WhatsApp Group of Tehreek-e-Naujawanan Roundu.
              </span>
            </label>
            <p className="mt-2 text-xs text-gray-400">The group link is shared only with approved members after login.</p>
          </Card>}

          {/* ── Review & Submit ── */}
          {onReview && (
            <Card title="Review Your Application">
              <p className="text-[13px] text-gray-500 -mt-1">
                Check every answer below. Use “Edit” to correct anything before submitting.
              </p>
              {STEPS.slice(0, 5).map((st, i) => (
                <div key={st.key} className="rounded-tnr border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-black uppercase tracking-wide" style={{ color: C.deep }}>
                      {st.title}
                    </h3>
                    <button type="button" onClick={() => { setErr(''); setTried(false); setStep(i); }}
                      className="text-[12px] font-bold underline" style={{ color: C.green }}>Edit</button>
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    {reviewRows(f, st.key).map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-[13px]">
                        <dt className="w-40 shrink-0 text-gray-400">{k}</dt>
                        <dd className="flex-1 text-gray-700 break-words">{v || <span className="text-red-500">Not provided</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              <p className="text-[12px] text-gray-400">
                Your application is reviewed by the membership committee. Membership becomes
                active only after approval — you will receive a reference number to track it.
              </p>
            </Card>
          )}

          {err && <div className="rounded-tnr bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3" role="alert">{err}</div>}

          {/* ── Step navigation ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {step > 0 && (
              <button type="button" onClick={back} disabled={busy}
                className="sm:w-40 py-3.5 rounded-tnr font-bold border transition-colors duration-micro
                  hover:bg-tnr-neutral disabled:opacity-40"
                style={{ borderColor: 'rgba(10,61,44,.16)', color: C.deep }}>
                ← Back
              </button>
            )}
            {!onReview ? (
              /* Kept clickable on purpose: a disabled button gives no reason why,
                 so pressing it reveals exactly what is still missing. */
              <button type="button" onClick={next}
                className="flex-1 py-3.5 rounded-tnr font-bold text-white shadow-tnr-raise
                  transition-transform duration-micro hover:-translate-y-[2px]"
                style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                Continue →
              </button>
            ) : (
              <button type="submit" disabled={busy}
                className="flex-1 py-3.5 rounded-tnr font-bold text-white text-lg shadow-tnr-raise
                  transition-transform duration-micro hover:-translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: missing && tried
                  ? 'linear-gradient(180deg,#9CA3AF,#6B7280)'
                  : `linear-gradient(180deg,${C.green},${C.deep})` }}>
                {busy ? 'Submitting…' : missing && tried
                  ? `${missing} field${missing === 1 ? '' : 's'} still required`
                  : 'Submit Application'}
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-400">
            Already applied? <a href="/membership/status" className="font-semibold" style={{ color: C.green }}>Check your application status</a>
          </p>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}

/* ── small building blocks ── */
function Card({ title, children }) {
  return <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
    <h2 style={{ ...mont, color: C.deep }} className="text-sm font-black uppercase tracking-wide">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </div>;
}
const Grid = ({ children }) => <div className="grid sm:grid-cols-2 gap-4">{children}</div>;

/* Section divider inside a card. Same type treatment as the Card title, one
   step quieter, so the new sections read as original rather than bolted on. */
const SubHeading = ({ children }) => (
  <div className="pt-2 first:pt-0">
    <h3 style={{ ...mont, color: C.deep }}
      className="text-[11px] font-black uppercase tracking-[.14em]">{children}</h3>
    <div className="mt-1.5 h-px bg-gray-100" />
  </div>
);
function Field({ label, req, error, children }) {
  return <div data-invalid={error ? 'true' : undefined}>
    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
      {label}{req && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
  </div>;
}
const base = 'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition bg-white';
const ring = (bad) => `${base} ${bad ? 'border-red-300 focus:border-red-500 bg-red-50/40' : 'border-gray-200 focus:border-[#0B6B4F]'}`;
const Input = ({ value, onChange, onBlur, bad, type = 'text', placeholder, min, max }) =>
  <input type={type} value={value} placeholder={placeholder} onBlur={onBlur} min={min} max={max}
    onChange={e => onChange(e.target.value)} className={ring(bad)} />;
const Textarea = ({ value, onChange, onBlur, bad, rows = 3 }) =>
  <textarea rows={rows} value={value} onBlur={onBlur}
    onChange={e => onChange(e.target.value)} className={ring(bad) + ' leading-relaxed'} />;
/* Searchable single-select. A native <input list> gives real type-ahead
   filtering across a long list, which a <select> does not, while remaining the
   same element the rest of the form already styles. The validator rejects
   anything that is not on the list, so free typing cannot create a stray
   category. */
const Combo = ({ value, onChange, onBlur, bad, options, listId, placeholder }) => (
  <>
    <input list={listId} value={value} placeholder={placeholder} onBlur={onBlur}
      onChange={e => onChange(e.target.value)} className={ring(bad)} autoComplete="off" />
    <datalist id={listId}>
      {options.map(o => <option key={o} value={o} />)}
    </datalist>
  </>
);
const Select = ({ value, onChange, onBlur, bad, options, placeholder = '— select —', disabled }) =>
  <select value={value} onBlur={onBlur} disabled={disabled} onChange={e => onChange(e.target.value)}
    className={ring(bad) + (disabled ? ' opacity-50 cursor-not-allowed' : '')}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>;
