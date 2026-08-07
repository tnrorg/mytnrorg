'use client';
import { useEffect, useState, useRef } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { printSheet } from '@/components/member/printSheet';
import { mGet, mPatch, mPost } from '@/components/member/memberApi';
import { COVER_TEMPLATES } from '@/lib/membership/cv';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const base = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0B6B4F]';

export default function LetterEditor({ params }) {
  const [l, setL] = useState(null);
  const [me, setMe] = useState(null);
  const [saved, setSaved] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    mGet('/api/member/cover-letters/' + params.id).then(r => r.ok && setL(r.letter));
    mGet('/api/member/me').then(r => r.ok && setMe(r.member));
  }, [params.id]);

  const set = (k, v) => {
    const next = { ...l, [k]: v };
    setL(next); setSaved('Saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await mPatch('/api/member/cover-letters/' + params.id, { [k]: v });
      setSaved(r.ok ? 'Saved' : 'Save failed');
      setTimeout(() => setSaved(''), 1500);
    }, 900);
  };

  async function duplicate() {
    const r = await mPost('/api/member/cover-letters/' + params.id);
    if (r.ok) window.location.href = '/member/cover-letters/' + r.letter.id;
  }
  async function remove() {
    if (!confirm('Delete this cover letter?')) return;
    await fetch('/api/member/cover-letters/' + params.id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('tnr_member_token') },
    });
    window.location.href = '/member/cover-letters';
  }
  const copyText = () => {
    const el = document.getElementById('letter-sheet');
    navigator.clipboard?.writeText(el?.innerText || '').then(() => alert('Letter text copied.'));
  };

  if (!l) return <MemberShell active="/member/cover-letters"><p className="text-gray-400">Loading…</p></MemberShell>;
  const today = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' });

  return (
    <MemberShell active="/member/cover-letters">
      <div className="flex items-center gap-3 flex-wrap">
        <a href="/member/cover-letters" className="text-sm" style={{ color: C.green }}>← All letters</a>
        <input value={l.title} onChange={e => set('title', e.target.value)}
          className="flex-1 min-w-[180px] text-xl font-black bg-transparent outline-none" style={{ ...mont, color: C.deep }} />
        <span className="text-xs text-gray-400 w-16">{saved}</span>
        <button onClick={() => printSheet('letter-sheet', l.title)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
          Download / Print PDF
        </button>
        <button onClick={copyText} className="px-3 py-2 rounded-xl text-sm border border-gray-200">Copy Text</button>
        <button onClick={duplicate} className="px-3 py-2 rounded-xl text-sm border border-gray-200">Duplicate</button>
        <button onClick={remove} className="px-3 py-2 rounded-xl text-sm text-red-500 border border-red-200">Delete</button>
      </div>

      <div className="mt-5 grid lg:grid-cols-[380px,1fr] gap-5 items-start">
        <div className="space-y-4">
          <Panel title="Details">
            <select value={l.template} onChange={e => set('template', e.target.value)} className={base + ' mb-3'}>
              {COVER_TEMPLATES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            {[['target_position', 'Target Position'], ['company', 'Company / Organization'],
              ['hiring_manager', 'Hiring Manager Name'], ['company_address', 'Company Address'],
              ['sign_off', 'Sign-off']].map(([k, lab]) => (
              <div key={k} className="mb-2">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">{lab}</label>
                <input value={l[k] || ''} onChange={e => set(k, e.target.value)} className={base} />
              </div>
            ))}
          </Panel>

          <Panel title="Letter Content">
            {[['opening', 'Opening Paragraph', 3], ['body', 'Main Body', 8], ['closing', 'Closing Paragraph', 3]].map(([k, lab, rows]) => (
              <div key={k} className="mb-3">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">{lab}</label>
                <textarea rows={rows} value={l[k] || ''} onChange={e => set(k, e.target.value)} className={base} />
              </div>
            ))}
          </Panel>

          <Panel title="Reference Notes (not printed)">
            {[['job_description', 'Job Description'], ['relevant_skills', 'Relevant Skills'],
              ['relevant_experience', 'Relevant Experience']].map(([k, lab]) => (
              <div key={k} className="mb-2">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">{lab}</label>
                <textarea rows={2} value={l[k] || ''} onChange={e => set(k, e.target.value)} className={base} />
              </div>
            ))}
          </Panel>
        </div>

        {/* Live A4 preview */}
        <div className="overflow-auto">
          <div className="origin-top-left scale-[0.62] sm:scale-75 lg:scale-[0.85] xl:scale-100">
            <div id="letter-sheet" className="bg-white mx-auto shadow-lg"
              style={{ width: '210mm', minHeight: '297mm', padding: '20mm', color: '#111',
                fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' }}>
              <div className="text-right text-[10pt] text-gray-500">{today}</div>
              <div className="mt-6 text-[11pt] font-bold" style={{ color: C.deep }}>{me?.full_name}</div>
              <div className="text-[9.5pt] text-gray-600">
                {[me?.email, me?.mobile].filter(Boolean).join(' · ')}
              </div>

              {(l.hiring_manager || l.company) && (
                <div className="mt-8 text-[10pt]">
                  {l.hiring_manager && <div className="font-semibold">{l.hiring_manager}</div>}
                  {l.company && <div>{l.company}</div>}
                  {l.company_address && <div className="text-gray-600 whitespace-pre-line">{l.company_address}</div>}
                </div>
              )}

              {l.target_position && (
                <div className="mt-6 text-[10.5pt] font-bold">Re: Application for {l.target_position}</div>
              )}

              <div className="mt-4 text-[10.5pt] leading-relaxed space-y-3">
                <p>Dear {l.hiring_manager || 'Hiring Manager'},</p>
                {l.opening && <p className="whitespace-pre-line">{l.opening}</p>}
                {l.body && <p className="whitespace-pre-line">{l.body}</p>}
                {l.closing && <p className="whitespace-pre-line">{l.closing}</p>}
              </div>

              <div className="mt-8 text-[10.5pt]">
                <div>{l.sign_off || 'Sincerely'},</div>
                <div className="mt-6 font-bold" style={{ color: C.deep }}>{me?.full_name}</div>
                {me?.membership_id && <div className="text-[9pt] text-gray-500">TNR Member · {me.membership_id}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MemberShell>
  );
}

const Panel = ({ title, children }) => (
  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
    <h3 style={{ ...mont, color: C.deep }} className="text-xs font-black uppercase tracking-wide mb-3">{title}</h3>
    {children}
  </div>
);
