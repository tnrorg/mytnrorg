'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function Events() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => mGet('/api/member/events').then(r => r.ok && setD(r));
  useEffect(() => { load(); }, []);

  const act = async (e) => {
    const r = await mPost('/api/member/events', { action: e.registered ? 'cancel' : 'register', event_id: e.id });
    if (!r.ok) setMsg(r.message || 'Could not update registration.'); else setMsg('');
    load();
  };
  const fmt = (x) => x ? new Date(x).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA';

  return (
    <MemberShell active="/member/events">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Events &amp; Programs</h1>
      <p className="mt-1 text-sm text-gray-500">Meetings, webinars and workshops for TNR members.</p>
      {msg && <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">{msg}</div>}

      {d && !d.events.length && (
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-4xl">📅</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No upcoming events</h3>
          <p className="mt-1 text-sm text-gray-500">Events published by TNR will appear here.</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {(d?.events || []).map(e => (
          <div key={e.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase" style={{ color: C.green }}>{e.mode}</div>
              <h3 style={{ ...mont, color: C.deep }} className="font-extrabold mt-0.5">{e.title}</h3>
              <div className="text-xs text-gray-500 mt-0.5">{fmt(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</div>
              {e.description && <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{e.description}</p>}
              {e.registered && e.meeting_url && (
                <a href={e.meeting_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-bold" style={{ color: C.green }}>Join link →</a>
              )}
            </div>
            <button onClick={() => act(e)}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${e.registered ? 'border border-gray-200 text-gray-600' : 'text-white'}`}
              style={e.registered ? {} : { background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
              {e.registered ? 'Cancel Registration' : 'Register'}
            </button>
          </div>
        ))}
      </div>
    </MemberShell>
  );
}
