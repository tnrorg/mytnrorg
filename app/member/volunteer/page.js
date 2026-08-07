'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function Volunteer() {
  const [d, setD] = useState(null);
  const load = () => mGet('/api/member/volunteer').then(r => r.ok && setD(r));
  useEffect(() => { load(); }, []);
  const apply = async (o) => { await mPost('/api/member/volunteer', { volunteer_opportunity_id: o.id }); load(); };

  return (
    <MemberShell active="/member/volunteer">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Volunteer Activities</h1>
      <p className="mt-1 text-sm text-gray-500">Give your time to TNR community programmes.</p>

      {d && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[['Total Hours', d.total_hours || 0], ['Applications', d.assignments?.length || 0],
            ['Open Roles', d.opportunities?.length || 0]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 text-center">
              <div style={{ ...mont, color: C.deep }} className="text-2xl font-black">{v}</div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{l}</div>
            </div>
          ))}
        </div>
      )}

      {d && !d.opportunities.length && (
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-4xl">🤝</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No volunteer roles open</h3>
          <p className="mt-1 text-sm text-gray-500">Volunteer opportunities published by TNR will appear here.</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {(d?.opportunities || []).map(o => (
          <div key={o.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-0">
              {o.area && <div className="text-[11px] font-bold uppercase" style={{ color: C.green }}>{o.area}</div>}
              <h3 style={{ ...mont, color: C.deep }} className="font-extrabold mt-0.5">{o.title}</h3>
              {o.description && <p className="mt-1.5 text-sm text-gray-600 whitespace-pre-line">{o.description}</p>}
              {o.assignment && (
                <div className="mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{ background: '#0B6B4F14', color: C.green }}>{o.assignment.status}</span>
                  {o.assignment.task && <span className="ml-2 text-gray-500">Task: {o.assignment.task}</span>}
                </div>
              )}
            </div>
            {!o.assignment && (
              <button onClick={() => apply(o)} className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Apply</button>
            )}
          </div>
        ))}
      </div>
    </MemberShell>
  );
}
