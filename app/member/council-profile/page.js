'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPatch } from '@/components/member/memberApi';
import { COLORS, FONT } from '@/lib/design/tokens';

const asText = (v) => (Array.isArray(v) ? v.join('\n') : v || '');
const input = 'w-full rounded-tnr border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#176B49] bg-white';

function Field({ label, hint, children }) {
  return <label className="block">
    <span className="text-xs font-semibold text-gray-500">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
  </label>;
}

export default function CouncilProfilePage() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mGet('/api/member/leadership-profile').then(r => {
      if (!r?.ok) { setErr(r?.message || 'Could not load your profile.'); setF(false); return; }
      if (!r.profile) { setF(false); setErr(r.message || 'No profile has been created for you yet.'); return; }
      setF({
        ...r.profile,
        expertise: asText(r.profile.expertise),
        skills: asText(r.profile.skills),
        research_areas: asText(r.profile.research_areas),
      });
    });
  }, []);

  const set = (k) => (e) => {
    setMsg(''); setErr('');
    setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };

  async function save() {
    setBusy(true); setMsg(''); setErr('');
    const r = await mPatch('/api/member/leadership-profile', f);
    setBusy(false);
    if (!r?.ok) return setErr(r?.message || 'Could not save.');
    setMsg('Profile saved. Your public page is updated.');
  }

  return (
    <MemberShell active="/member/council-profile">
      <div style={FONT} className="max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: COLORS.green900 }}>My Public Profile</h1>
          <p className="mt-1 text-sm" style={{ color: COLORS.muted }}>
            This is what visitors see on your public profile page. Your designation and
            verified badge are set by the TNR secretariat, not here.
          </p>
        </div>

        {f === null && <div className="h-64 rounded-tnr-lg bg-gray-100 animate-pulse" />}

        {f === false && (
          <div className="rounded-tnr-lg bg-white border border-gray-100 p-8 text-center">
            <div className="text-4xl" aria-hidden="true">📋</div>
            <h2 className="mt-3 font-extrabold" style={{ color: COLORS.green900 }}>Profile not ready yet</h2>
            <p className="mt-1 text-sm" style={{ color: COLORS.muted }}>{err}</p>
            <p className="mt-3 text-[12px] text-gray-400">
              The secretariat creates your profile after your appointment is confirmed.
              You will be able to complete it here once that is done.
            </p>
          </div>
        )}

        {f && (
          <>
            {f.slug && (
              <a href={`/council/${f.slug}`} target="_blank" rel="noopener noreferrer"
                className="inline-block text-sm font-bold underline" style={{ color: COLORS.green700 }}>
                View my public page ↗
              </a>
            )}

            <section className="rounded-tnr-lg bg-white border border-gray-100 p-5 space-y-4">
              <h2 className="font-black text-sm uppercase tracking-wide" style={{ color: COLORS.green900 }}>Professional details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Current Profession"><input className={input} value={f.profession || ''} onChange={set('profession')} /></Field>
                <Field label="Organisation / University"><input className={input} value={f.organisation || ''} onChange={set('organisation')} /></Field>
                <Field label="Country"><input className={input} value={f.country || ''} onChange={set('country')} /></Field>
                <Field label="Highest Qualification" hint="Write it as you would on a CV — e.g. BS Software Engineering, MS Chemistry, MBBS.">
                  <input className={input} value={f.qualification || ''} onChange={set('qualification')} />
                </Field>
              </div>
              <Field label="Professional Tagline" hint="One line shown under your name.">
                <input className={input} value={f.tagline || ''} onChange={set('tagline')} />
              </Field>
              <Field label="Card Introduction" hint="2–3 lines shown on the council roster card.">
                <textarea rows={3} className={input} value={f.intro || ''} onChange={set('intro')} />
              </Field>
              <Field label="Full Biography" hint="Background, professional journey, vision and community contribution.">
                <textarea rows={8} className={input + ' leading-relaxed'} value={f.bio || ''} onChange={set('bio')} />
              </Field>
            </section>

            <section className="rounded-tnr-lg bg-white border border-gray-100 p-5 space-y-4">
              <h2 className="font-black text-sm uppercase tracking-wide" style={{ color: COLORS.green900 }}>Expertise</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Areas of Expertise — one per line">
                  <textarea rows={5} className={input} value={f.expertise} onChange={set('expertise')} />
                </Field>
                <Field label="Professional Skills — one per line">
                  <textarea rows={5} className={input} value={f.skills} onChange={set('skills')} />
                </Field>
              </div>
              <Field label="Research Areas — one per line">
                <textarea rows={3} className={input} value={f.research_areas} onChange={set('research_areas')} />
              </Field>
            </section>

            <section className="rounded-tnr-lg bg-white border border-gray-100 p-5 space-y-4">
              <h2 className="font-black text-sm uppercase tracking-wide" style={{ color: COLORS.green900 }}>Contact & visibility</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email"><input type="email" className={input} value={f.email || ''} onChange={set('email')} /></Field>
                <Field label="Mobile"><input className={input} value={f.mobile || ''} onChange={set('mobile')} /></Field>
              </div>
              <div className="rounded-tnr p-4 space-y-2" style={{ background: COLORS.neutral }}>
                {[['show_email', 'Show my email on my public profile'],
                  ['show_mobile', 'Show my mobile number on my public profile'],
                  ['accepts_guidance', 'Accept guidance requests from TNR members']].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: COLORS.charcoal }}>
                    <input type="checkbox" className="w-4 h-4"
                      checked={k === 'accepts_guidance' ? f[k] !== false : f[k] === true}
                      onChange={set(k)} />
                    {label}
                  </label>
                ))}
                <p className="text-[11px] pt-1" style={{ color: COLORS.muted }}>
                  When a contact field is switched off it is not sent to the browser at all,
                  so it cannot be read from your public page.
                </p>
              </div>
            </section>

            {err && <div className="rounded-tnr bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3" role="alert">{err}</div>}
            {msg && <div className="rounded-tnr bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3" role="status">{msg}</div>}

            <button onClick={save} disabled={busy}
              className="rounded-tnr px-6 py-3 font-bold text-white disabled:opacity-40"
              style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
              {busy ? 'Saving…' : 'Save Profile'}
            </button>
          </>
        )}
      </div>
    </MemberShell>
  );
}
