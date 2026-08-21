'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft, Briefcase, CalendarDays, Building2, MapPin, Clock,
  CheckCircle2, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { mGet, mPost } from '@/components/member/memberApi';
import {
  categoryLabel, CATEGORY_TONE, STATUS_LABEL, STATUS_TONE,
  APP_STATUS_LABEL, APP_STATUS_TONE, FELLOWSHIP_QUESTIONS, DECLARATION_TEXT,
  validateAnswers, fmtDate,
} from '@/lib/opportunities';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* Full opportunity detail, members only.
 *
 * Every field is optional. The admin decides which ones an opportunity uses,
 * and a section with nothing in it is not rendered at all — an empty
 * "Eligibility" heading tells a reader there are criteria they cannot see,
 * which is worse than not raising the subject.
 */
export default function OpportunityDetail({ id, onBack }) {
  const [d, setD] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = () => mGet(`/api/member/opportunities?id=${encodeURIComponent(id)}`)
    .then(r => (r.ok ? setD(r) : setNotFound(true)));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (notFound) return (
    <div className="py-16 text-center">
      <h1 style={{ ...mont, color: C.deep }} className="text-xl font-black">Opportunity not found</h1>
      <button onClick={onBack} className="mt-3 text-sm font-bold hover:underline" style={{ color: C.green }}>
        ← Back to opportunities
      </button>
    </div>
  );

  if (!d) return (
    <div className="space-y-4">
      <div className="h-8 w-40 rounded bg-gray-100 animate-pulse" />
      <div className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
    </div>
  );

  const o = d.opportunity;
  const cat = categoryLabel(o);
  const catTone = CATEGORY_TONE[o.category] || CATEGORY_TONE.Other;
  const stTone = STATUS_TONE[o.state] || STATUS_TONE.open;

  // Only sections the admin actually filled in.
  const sections = [
    ['About this opportunity', o.full_description || o.description],
    ['Eligibility', o.eligibility],
    ['Benefits', o.benefits],
    ['Duration', o.duration],
    ['Important Dates', o.important_dates],
    ['Required Documents', o.required_documents],
    ['How to Apply', o.instructions],
    ['Terms & Conditions', o.terms],
    ['Additional Information', o.additional_info],
  ].filter(([, v]) => String(v || '').trim());

  return (
    <div>
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold hover:underline"
        style={{ color: C.green }}>
        <ArrowLeft size={14} aria-hidden="true" /> All opportunities
      </button>

      {/* ── Header ── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="relative aspect-[21/9] bg-gray-100">
          {o.cover_url ? (
            <Image src={o.cover_url} alt="" fill sizes="100vw" className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 grid place-items-center"
              style={{ background: `linear-gradient(140deg, ${C.green}, ${C.deep})` }}>
              <Briefcase size={36} className="text-white/30" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
              style={{ background: catTone.bg, color: catTone.fg }}>{cat}</span>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
              style={{ background: stTone.bg, color: stTone.fg }}>{STATUS_LABEL[o.state]}</span>
          </div>

          <h1 style={{ ...mont, color: C.deep }} className="mt-3 text-2xl sm:text-3xl font-black leading-tight">
            {o.title}
          </h1>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-gray-600">
            {o.organization && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={13} aria-hidden="true" />{o.organization}
              </span>
            )}
            {o.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} aria-hidden="true" />{o.location}
              </span>
            )}
            {o.duration && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} aria-hidden="true" />{o.duration}
              </span>
            )}
            {(o.deadline || o.closes_at) && (
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: C.green }}>
                <CalendarDays size={13} aria-hidden="true" />
                Deadline: {fmtDate(o.closes_at || o.deadline)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail sections ── */}
      {sections.length > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
          {sections.map(([label, text]) => (
            <section key={label}>
              <h2 style={{ ...mont, color: C.deep }} className="font-extrabold text-[15px]">{label}</h2>
              {/* Rendered as text. `whitespace-pre-line` keeps the admin's line
                  breaks without interpreting anything as markup. */}
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-700 whitespace-pre-line">
                {text}
              </p>
            </section>
          ))}
        </div>
      )}

      {/* ── Apply ── */}
      <div className="mt-5">
        {d.application
          ? <Submitted app={d.application} />
          : o.application_type === 'external'
            ? <ExternalApply url={o.apply_url || o.external_url} accepting={d.accepting} />
            : o.application_type === 'internal'
              ? <ApplyForm d={d} onDone={load} />
              : null}
      </div>
    </div>
  );
}

/* ── Already applied ─────────────────────────────────────────────────────── */
function Submitted({ app }) {
  const tone = APP_STATUS_TONE[app.status] || APP_STATUS_TONE.submitted;
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(23,107,73,.25)', background: 'rgba(23,107,73,.04)' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} style={{ color: C.green }} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 style={{ ...mont, color: C.deep }} className="font-extrabold">Application Submitted</h2>
          <p className="mt-1 text-[13px] text-gray-600">
            Submitted on {fmtDate(app.submitted_at)}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-gray-500">Current status:</span>
            <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
              style={{ background: tone.bg, color: tone.fg }}>
              {APP_STATUS_LABEL[app.status] || app.status}
            </span>
          </div>

          {/* Interview details, once an admin has arranged one. */}
          {app.interview && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-[13px] text-gray-700 space-y-1">
              <div className="font-bold" style={{ color: C.deep }}>Interview details</div>
              {app.interview.date && <div>Date: {app.interview.date}</div>}
              {app.interview.time && <div>Time: {app.interview.time}</div>}
              {app.interview.mode && <div>Mode: {app.interview.mode}</div>}
              {app.interview.venue && <div>Link / Venue: {app.interview.venue}</div>}
              {app.interview.notes && <div className="text-gray-600">{app.interview.notes}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── External application ────────────────────────────────────────────────── */
function ExternalApply({ url, accepting }) {
  if (!url) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
      <p className="text-[13.5px] text-gray-600">
        Applications for this opportunity are handled on the provider&rsquo;s own website.
      </p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
        style={{ background: accepting === false ? '#64748B' : C.green }}>
        Apply on Official Website <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

/* ── Internal application ────────────────────────────────────────────────── */
function ApplyForm({ d, onDone }) {
  const o = d.opportunity;
  const profile = d.profile || {};
  const [answers, setAnswers] = useState({});
  const [gaps, setGaps] = useState({});
  const [accepted, setAccepted] = useState(false);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (!d.accepting) return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
      <p className="text-[13.5px] text-gray-600">
        Applications for this opportunity are closed.
      </p>
    </div>
  );

  // Required profile values the member does not have on file. Only these are
  // asked for — everything else is shown back to them, read-only.
  const missing = (d.profile_fields || []).filter(f => f.required && !String(profile[f.key] || '').trim());

  async function submit(e) {
    e.preventDefault();
    const problems = validateAnswers(answers, accepted);
    for (const f of missing) {
      if (!String(gaps[f.key] || '').trim()) problems[f.key] = `${f.label} is required.`;
    }
    setErrs(problems);
    if (Object.keys(problems).length) {
      setNote('Please complete every question before submitting.');
      return;
    }

    setBusy(true); setNote('');
    const r = await mPost('/api/member/opportunities', {
      action: 'apply', opportunity_id: o.id,
      answers, profile_gaps: gaps, declaration_accepted: true,
    });
    setBusy(false);

    if (!r.ok) {
      setErrs(r.errors || {});
      setNote(r.message || 'Could not submit your application.');
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 style={{ ...mont, color: C.deep }} className="text-lg font-black">Apply</h2>
      <p className="mt-1 text-[13px] text-gray-500">
        This takes about two minutes — most of it is already filled in from your profile.
      </p>

      {/* ── Auto-fetched profile ── */}
      <div className="mt-5 rounded-xl border p-4"
        style={{ borderColor: 'rgba(23,107,73,.22)', background: 'rgba(23,107,73,.04)' }}>
        <p className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: C.green }}>
          <ShieldCheck size={14} aria-hidden="true" />
          Your TNR profile information has been added automatically.
        </p>
        <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {(d.profile_fields || []).map(f => {
            const v = String(profile[f.key] || '').trim();
            if (!v) return null;
            return (
              <div key={f.key} className="flex justify-between gap-3 border-b border-black/5 pb-1">
                <dt className="text-[12px] text-gray-500">{f.label}</dt>
                <dd className="text-[12.5px] font-semibold text-right" style={{ color: C.deep }}>
                  {f.type === 'date' ? fmtDate(v) : v}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-[11px] text-gray-500">
          To change any of this, update it in My Profile — it stays correct everywhere.
        </p>
      </div>

      {/* ── Only what the profile is missing ── */}
      {missing.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-[12.5px] font-bold text-amber-700">
            A few details are not on your profile yet. Please add them:
          </p>
          {missing.map(f => (
            <label key={f.key} className="block">
              <span className="block text-xs font-bold text-gray-600 mb-1.5">{f.label} *</span>
              <input type={f.type === 'date' ? 'date' : 'text'}
                value={gaps[f.key] || ''}
                onChange={e => setGaps({ ...gaps, [f.key]: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
              {errs[f.key] && <span className="mt-1 block text-[11px] text-red-600">{errs[f.key]}</span>}
            </label>
          ))}
        </div>
      )}

      {/* ── The five questions ── */}
      <div className="mt-6 space-y-5">
        {FELLOWSHIP_QUESTIONS.map((q, i) => (
          <fieldset key={q.key}>
            <legend className="text-[13.5px] font-bold" style={{ color: C.deep }}>
              {i + 1}. {q.label}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map(opt => {
                const on = answers[q.key] === opt;
                return (
                  <button type="button" key={opt}
                    onClick={() => setAnswers({ ...answers, [q.key]: opt })}
                    className={`rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition ${on
                      ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    style={on ? { background: C.green } : {}}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {q.otherKey && answers[q.key] === 'Other' && (
              <input value={answers[q.otherKey] || ''}
                onChange={e => setAnswers({ ...answers, [q.otherKey]: e.target.value })}
                placeholder="Please tell us which area"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
            )}
            {(errs[q.key] || errs[q.otherKey]) && (
              <p className="mt-1 text-[11px] text-red-600">{errs[q.key] || errs[q.otherKey]}</p>
            )}
          </fieldset>
        ))}
      </div>

      {/* ── Declaration ── */}
      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={accepted} className="mt-1 w-4 h-4 shrink-0"
          onChange={e => setAccepted(e.target.checked)} />
        <span className="text-[13px] text-gray-600 leading-relaxed">{DECLARATION_TEXT}</span>
      </label>
      {errs.declaration && <p className="mt-1 text-[11px] text-red-600">{errs.declaration}</p>}

      {note && <p className="mt-3 text-[12.5px] font-semibold text-amber-700">{note}</p>}

      <button type="submit" disabled={busy}
        className="mt-5 w-full rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ background: C.green }}>
        {busy ? 'Submitting…' : 'Submit Application'}
      </button>
    </form>
  );
}
