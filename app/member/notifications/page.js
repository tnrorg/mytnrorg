'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPatch } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function Notifications() {
  const [d, setD] = useState(null);
  const load = () => mGet('/api/member/notifications').then(r => r.ok && setD(r));
  useEffect(() => { load(); }, []);
  const markAll = async () => { await mPatch('/api/member/notifications', {}); load(); };

  return (
    <MemberShell active="/member/notifications">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Notifications</h1>
          {d && <p className="mt-1 text-sm text-gray-500">{d.unread} unread</p>}
        </div>
        {d?.unread > 0 && <button onClick={markAll} className="text-sm font-semibold" style={{ color: C.green }}>Mark all as read</button>}
      </div>

      {d && !d.notifications.length && (
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-4xl">🔔</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No notifications</h3>
          <p className="mt-1 text-sm text-gray-500">Updates about your membership will appear here.</p>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {(d?.notifications || []).map(n => (
          <a key={n.id} href={n.link || '#'}
            className={`block rounded-2xl border shadow-sm p-4 ${n.read_at ? 'bg-white border-gray-100' : 'bg-[#0B6B4F08] border-[#0B6B4F33]'}`}>
            <div className="flex items-start gap-3">
              {!n.read_at && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: C.green }} />}
              <div className="min-w-0">
                <div style={{ ...mont, color: C.deep }} className="font-bold text-sm">{n.title}</div>
                {n.body && <div className="text-sm text-gray-600 mt-0.5">{n.body}</div>}
                <div className="text-[11px] text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </MemberShell>
  );
}
