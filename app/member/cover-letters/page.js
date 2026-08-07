'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function LetterList() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => mGet('/api/member/cover-letters').then(r => r.ok && setRows(r.letters || []));
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    const r = await mPost('/api/member/cover-letters', { title: 'New Cover Letter' });
    setBusy(false);
    if (r.ok) window.location.href = '/member/cover-letters/' + r.letter.id;
  }

  return (
    <MemberShell active="/member/cover-letters">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Cover Letters</h1>
          <p className="mt-1 text-sm text-gray-500">Write and store tailored cover letters for each application.</p>
        </div>
        <button onClick={create} disabled={busy}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>+ New Letter</button>
      </div>

      {rows === null && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {rows?.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl">✉️</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No cover letters yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first letter — your details are filled in from your profile.</p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {(rows || []).map(l => (
          <a key={l.id} href={'/member/cover-letters/' + l.id}
            className="block rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition p-4">
            <div style={{ ...mont, color: C.deep }} className="font-extrabold">{l.title}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[l.target_position, l.company].filter(Boolean).join(' · ') || 'No position set'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Updated {new Date(l.updated_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            </div>
          </a>
        ))}
      </div>
    </MemberShell>
  );
}
