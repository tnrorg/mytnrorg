'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function Opportunities() {
  const [d, setD] = useState(null); const [cat, setCat] = useState('');
  const load = () => mGet('/api/member/opportunities' + (cat ? '?category=' + encodeURIComponent(cat) : ''))
    .then(r => r.ok && setD(r));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat]);

  const toggle = async (o) => { await mPost('/api/member/opportunities',
    { action: o.saved ? 'unsave' : 'save', opportunity_id: o.id }); load(); };

  return (
    <MemberShell active="/member/opportunities">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Jobs &amp; Scholarships</h1>
      <p className="mt-1 text-sm text-gray-500">Opportunities shared with TNR members.</p>

      {d?.categories?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {['', ...d.categories].map(c => (
            <button key={c || 'all'} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${cat === c
                ? 'text-white border-transparent font-semibold' : 'bg-white text-gray-600 border-gray-200'}`}
              style={cat === c ? { background: C.green } : {}}>{c || 'All'}</button>
          ))}
        </div>
      )}

      {d && !d.opportunities.length && <Empty icon="💼" title="No opportunities yet"
        text="Jobs, scholarships and internships posted by TNR will appear here." />}

      <div className="mt-5 space-y-3">
        {(d?.opportunities || []).map(o => (
          <div key={o.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.green }}>{o.category}</div>
                <h3 style={{ ...mont, color: C.deep }} className="font-extrabold mt-0.5">{o.title}</h3>
                <div className="text-xs text-gray-500">{[o.organization, o.location].filter(Boolean).join(' · ')}</div>
                {o.description && <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{o.description}</p>}
                {o.eligibility && <p className="mt-2 text-xs text-gray-500"><b>Eligibility:</b> {o.eligibility}</p>}
                {o.deadline && <p className="mt-2 text-xs font-semibold text-amber-700">
                  Deadline: {new Date(o.deadline).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</p>}
              </div>
              <div className="flex flex-col gap-2">
                {o.external_url && <a href={o.external_url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white text-center"
                  style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Apply</a>}
                <button onClick={() => toggle(o)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200">
                  {o.saved ? '★ Saved' : '☆ Save'}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MemberShell>
  );
}
function Empty({ icon, title, text }) {
  return <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
    <div className="text-4xl">{icon}</div>
    <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{text}</p>
  </div>;
}
