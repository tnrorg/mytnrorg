'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, CalendarClock, Users } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { EmptyState, Skeleton } from '@/components/ui';
import { WRITTEN_QUESTIONS, DECLARATION, validateApplication, wordCount } from '@/lib/cec';
import { COLORS, FONT } from '@/lib/design/tokens';

/* Application form for Executive Committee positions.
 *
 * The situational question comes from the chosen position, not from this file:
 * each post is asked something different, and hardcoding one question here
 * would defeat the purpose of asking it.
 */
const card = 'rounded-tnr-lg bg-white p-6 shadow-tnr-flat border border-[rgba(200,154,43,.35)]';
const input = 'mt-1 w-full rounded-tnr border px-3.5 py-2.5 text-[14px] bg-white';
const inputStyle = { borderColor: 'rgba(10,61,44,.18)', color: COLORS.charcoal };

export default function CecApplyPage() {
  const [vacancies, setVacancies] = useState(null);
  const [f, setF] = useState({ vacancy_id: '' });
  const [errors, setErrors] = useState({});
  const [photoErr, setPhotoErr] = useState('');

  /* Read the chosen file into a data URL so it travels with the rest of the
   * form in one request — the same approach the membership application uses.
   *
   * Checked here for an instant answer, and again on the server, which is
   * where it actually matters: this endpoint is public and does not have to
   * be reached through this form. */
  const pickPhoto = (file) => {
    setPhotoErr('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setPhotoErr('Photo must be a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoErr('Photo must be smaller than 4 MB.');
      return;
    }
    const fr = new FileReader();
    fr.onload = () => setF(p => ({ ...p, photo_data: fr.result }));
    fr.onerror = () => setPhotoErr('Could not read that file. Try another.');
    fr.readAsDataURL(file);
  };
  const [showErr, setShowErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [fatal, setFatal] = useState('');

  useEffect(() => {
    fetch('/api/public/cec', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setVacancies(j?.ok ? (j.vacancies || []) : []))
      .catch(() => setVacancies([]));
  }, []);

  const open = (vacancies || []).filter(v => v.accepting);
  const chosen = open.find(v => v.id === f.vacancy_id) || null;

  // Live validation, but only surfaced after the first submit attempt —
  // showing every field red before anyone has typed is just noise.
  useEffect(() => { setErrors(validateApplication(f)); }, [f]);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const err = (k) => (showErr ? errors[k] : null);

  async function submit() {
    setShowErr(true);
    setFatal('');
    const e = validateApplication(f);
    if (Object.keys(e).length) {
      setErrors(e);
      document.querySelector('[data-bad="1"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/public/cec/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => null);
      setBusy(false);
      if (j?.ok) { setDone(j); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      setFatal(j?.message || `The server returned ${r.status}. Please try again.`);
      if (j?.errors) setErrors(j.errors);
    } catch {
      setBusy(false);
      setFatal('Could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-tnr-snow"
      style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="text-white py-14"
        style={{ background: `linear-gradient(165deg,${COLORS.green950},${COLORS.green800})` }}>
        <div className="max-w-tnr mx-auto px-5">
          <div className="text-[11px] font-bold uppercase tracking-[.2em]" style={{ color: COLORS.gold400 }}>
            Tehreek-e-Nojawanan Roundu
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">Application for Executive Positions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.72)' }}>
            TNR is inviting applications for vacant positions on the Central Executive
            Committee. Applications are reviewed by the selection panel.
          </p>
        </div>
      </header>

      <section className="max-w-tnr mx-auto px-5 py-12 w-full flex-1 space-y-6">
        {vacancies === null && <><Skeleton height="h-24" /><Skeleton height="h-64" /></>}

        {done && (
          <div className={card}>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={24} strokeWidth={2} style={{ color: COLORS.green700 }} aria-hidden="true" />
              <div>
                <h2 className="text-xl font-extrabold" style={{ color: COLORS.green900 }}>
                  Application submitted
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: COLORS.muted }}>
                  Thank you for applying for <b style={{ color: COLORS.charcoal }}>{done.position}</b>.
                  The selection panel will review your application and contact you directly.
                </p>
                {done.reference_no && (
                  <p className="mt-3 text-[14px]">
                    Your reference number:{' '}
                    <b className="tabular-nums" style={{ color: COLORS.green900 }}>{done.reference_no}</b>
                    <span className="block text-[12px] mt-0.5" style={{ color: COLORS.muted }}>
                      Keep this for any correspondence about your application.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!done && vacancies !== null && open.length === 0 && (
          <EmptyState icon="📋" title="No positions are open at the moment"
            message="Executive Committee vacancies are advertised here when they open. Please check back." />
        )}

        {!done && open.length > 0 && (
          <>
            {/* ── Positions available ── */}
            <div className={card}>
              <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>Positions Available</h2>
              <ul className="mt-4 space-y-3">
                {open.map(v => (
                  <li key={v.id} className="rounded-tnr border p-4" style={{ borderColor: COLORS.neutral }}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-bold text-[15px]" style={{ color: COLORS.green900 }}>{v.title}</span>
                      {v.seats > 1 && (
                        <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: COLORS.muted }}>
                          <Users size={12} aria-hidden="true" />{v.seats} seats
                        </span>
                      )}
                      {v.closes_on && (
                        <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: COLORS.muted }}>
                          <CalendarClock size={12} aria-hidden="true" />
                          Closes {new Date(v.closes_on).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {v.summary && <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>{v.summary}</p>}
                    {v.eligibility_note && (
                      <p className="mt-1.5 text-[12px] font-semibold" style={{ color: '#7A5C10' }}>{v.eligibility_note}</p>
                    )}
                    {!!(v.responsibilities || []).length && (
                      <ul className="mt-2.5 space-y-1">
                        {v.responsibilities.map(r => (
                          <li key={r} className="flex gap-2 text-[13px]" style={{ color: COLORS.charcoal }}>
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: COLORS.gold500 }} />{r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {fatal && (
              <div className="rounded-tnr-lg px-5 py-4 flex items-start gap-2.5 text-[13px] leading-relaxed"
                style={{ background: 'rgba(170,60,60,.08)', color: '#8A2F2F' }}>
                <AlertCircle size={17} className="shrink-0 mt-0.5" aria-hidden="true" />{fatal}
              </div>
            )}

            {/* ── Section 1 ── */}
            <Block title="Section 1 — Personal Information">
              <Field label="Full name" required error={err('full_name')}>
                <input className={input} style={inputStyle} value={f.full_name || ''} onChange={set('full_name')} />
              </Field>

              {/* Passport photograph.
                  Sits at the top of the section, beside the name it belongs
                  to, so the panel reviewing a shortlist sees a face against
                  each set of answers. */}
              <Field label="Passport-size photograph" required error={err('photo_data')}>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-24 shrink-0 rounded-xl overflow-hidden border-2 border-dashed
                    border-gray-200 bg-gray-50 grid place-items-center">
                    {f.photo_data
                      ? <img src={f.photo_data} alt="Selected photograph" className="w-full h-full object-cover" />
                      : <span className="text-[10px] text-gray-400 text-center px-1">No photo</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input type="file" accept="image/png,image/jpeg,image/webp"
                      onChange={e => pickPhoto(e.target.files?.[0])}
                      className="block w-full text-xs text-gray-600
                        file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                        file:text-xs file:font-bold file:text-white file:cursor-pointer
                        file:bg-[#0B6B4F] hover:file:bg-[#063D2B]" />
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      A clear, recent head-and-shoulders photo. JPG, PNG or WEBP, under 4 MB.
                    </p>
                    {photoErr && <p className="mt-1 text-[11px] text-red-600">{photoErr}</p>}
                  </div>
                </div>
              </Field>

              <Field label="Position applying for" required error={err('vacancy_id')}>
                <select className={input} style={inputStyle} value={f.vacancy_id} onChange={set('vacancy_id')}>
                  <option value="">— Select a position —</option>
                  {open.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Phone number" required error={err('mobile')}>
                  <input className={input} style={inputStyle} value={f.mobile || ''} onChange={set('mobile')}
                    placeholder="03xx xxxxxxx" />
                </Field>
                <Field label="Email address" required error={err('email')}>
                  <input type="email" className={input} style={inputStyle} value={f.email || ''} onChange={set('email')} />
                </Field>
              </div>

              <Field label="Educational qualification" required error={err('education_level')}>
                <input className={input} style={inputStyle} value={f.education_level || ''} onChange={set('education_level')}
                  placeholder="e.g. BS Software Engineering, MA Political Science" />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Current occupation" required error={err('current_position')}>
                  <input className={input} style={inputStyle} value={f.current_position || ''} onChange={set('current_position')} />
                </Field>
                <Field label="Organisation">
                  <input className={input} style={inputStyle} value={f.organisation || ''} onChange={set('organisation')} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Union Council">
                  <input className={input} style={inputStyle} value={f.union_council || ''} onChange={set('union_council')} />
                </Field>
                <Field label="Village / Area">
                  <input className={input} style={inputStyle} value={f.village || ''} onChange={set('village')} />
                </Field>
                <Field label="TNR membership number" hint="If you are already a member">
                  <input className={input} style={inputStyle} value={f.membership_id || ''} onChange={set('membership_id')}
                    placeholder="TNR-MN-0001" />
                </Field>
              </div>
            </Block>

            {/* ── Section 2 ── */}
            <Block title="Section 2 — Competency & Experience">
              <Long label={WRITTEN_QUESTIONS[0][1]} value={f.relevant_experience}
                onChange={set('relevant_experience')} error={err('relevant_experience')} />
            </Block>

            {/* ── Section 3 ── */}
            <Block title="Section 3 — Analytical & Situational Questions">
              <Long
                label={chosen?.scenario_question || 'Scenario question'}
                eyebrow={chosen ? `Scenario — ${chosen.title}` : 'Scenario'}
                placeholder={chosen ? undefined : 'Choose a position above to see this question.'}
                disabled={!chosen}
                value={f.scenario_answer} onChange={set('scenario_answer')} error={err('scenario_answer')} />

              <Long label={WRITTEN_QUESTIONS[1][1]} value={f.challenge_answer}
                onChange={set('challenge_answer')} error={err('challenge_answer')} />
              <Long label={WRITTEN_QUESTIONS[2][1]} value={f.leadership_answer}
                onChange={set('leadership_answer')} error={err('leadership_answer')} />
              <Long label={WRITTEN_QUESTIONS[3][1]} value={f.vision_answer}
                onChange={set('vision_answer')} error={err('vision_answer')} />
            </Block>

            {/* ── Declaration ── */}
            <div className={card} data-bad={err('declaration_accepted') ? '1' : undefined}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 shrink-0 accent-[#0B6B4F]"
                  checked={!!f.declaration_accepted}
                  onChange={e => setF(s => ({ ...s, declaration_accepted: e.target.checked }))} />
                <span className="text-[13.5px] leading-relaxed" style={{ color: COLORS.charcoal }}>
                  {DECLARATION}
                </span>
              </label>
              {err('declaration_accepted') && (
                <p className="mt-2 text-[12px] font-semibold" style={{ color: '#8A2F2F' }}>
                  {err('declaration_accepted')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button onClick={submit} disabled={busy}
                className="rounded-tnr px-7 py-3.5 font-bold text-white shadow-tnr-raise
                  transition-transform duration-micro hover:-translate-y-[2px] disabled:opacity-50"
                style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
                {busy ? 'Submitting…' : 'Submit Application'}
              </button>
              {showErr && Object.keys(errors).length > 0 && (
                <span className="text-[13px] font-semibold" style={{ color: '#8A2F2F' }}>
                  {Object.keys(errors).length} question{Object.keys(errors).length === 1 ? '' : 's'} still need attention.
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

function Block({ title, children }) {
  return (
    <div className={card}>
      <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>{title}</h2>
      <div className="mt-1.5 h-[2px] w-10" style={{ background: COLORS.gold500 }} />
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, error, children }) {
  return (
    <label className="block" data-bad={error ? '1' : undefined}>
      <span className="text-[13px] font-semibold" style={{ color: COLORS.charcoal }}>
        {label}{required && <span style={{ color: '#8A2F2F' }}> *</span>}
      </span>
      {hint && <span className="block text-[11.5px]" style={{ color: COLORS.muted }}>{hint}</span>}
      {children}
      {error && <span className="block mt-1 text-[12px] font-semibold" style={{ color: '#8A2F2F' }}>{error}</span>}
    </label>
  );
}

/* A long-answer question. The live word count is there because the API rejects
   very short answers — better to show the target while typing than to bounce
   someone back after they press Submit. */
function Long({ label, eyebrow, value, onChange, error, placeholder, disabled }) {
  const n = wordCount(value);
  return (
    <div data-bad={error ? '1' : undefined}>
      {eyebrow && (
        <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: COLORS.green700 }}>
          {eyebrow}
        </div>
      )}
      <label className="block">
        <span className="text-[13.5px] font-semibold leading-relaxed" style={{ color: COLORS.charcoal }}>{label}</span>
        <textarea rows={5} value={value || ''} onChange={onChange} disabled={disabled}
          placeholder={placeholder}
          className={`${input} leading-relaxed ${disabled ? 'opacity-50' : ''}`} style={inputStyle} />
      </label>
      <div className="mt-1 flex justify-between gap-3 text-[12px]">
        <span style={{ color: '#8A2F2F' }} className="font-semibold">{error || ''}</span>
        <span className="shrink-0 tabular-nums" style={{ color: COLORS.muted }}>
          {n} word{n === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}
