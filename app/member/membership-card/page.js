'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import MembershipCard from '@/components/member/MembershipCard';
import { printSheet } from '@/components/member/printSheet';
import { mGet } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function CardPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    mGet('/api/member/certificate')
      .then(r => { if (r?.ok) setD(r); else setErr(r?.detail || r?.message || 'Could not load.'); })
      .catch(e => setErr(e.message || 'Request failed.'));
  }, []);
  if (err) return (
    <MemberShell active="/member/membership-card">
      <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-sm">
        <div className="font-bold text-red-800">Could not load this page</div>
        <div className="mt-1 text-red-700 text-xs break-words">{err}</div>
        <div className="mt-2 text-red-700/80 text-xs">
          If this mentions a missing table or relation, run the membership migration files in
          Supabase (phase1 → phase6), in order.
        </div>
      </div>
    </MemberShell>
  );
  if (!d) return <MemberShell active="/member/membership-card"><p className="text-gray-400">Loading…</p></MemberShell>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verifyUrl = `${origin}/membership/verify?id=${d.member.membership_id}`;
  const valid = ['active', 'approved'].includes(d.member.status);

  return (
    <MemberShell active="/member/membership-card">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Digital Membership Card</h1>
      <p className="mt-1 text-sm text-gray-500">Your official TNR membership card. Anyone can verify it by scanning the QR code.</p>

      {!valid && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Your membership is currently <b>{d.member.status}</b>, so this card does not show as valid.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-8 items-start">
        <MembershipCard m={d.member} verifyUrl={verifyUrl} />
        <div className="space-y-3">
          <button onClick={() => printSheet('card-sheet', `TNR Card ${d.member.membership_id}`)}
            className="w-full px-5 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Download / Print Card</button>
          <a href={verifyUrl} target="_blank" rel="noopener noreferrer"
            className="block text-center px-5 py-3 rounded-xl text-sm font-bold border border-gray-200">Open Verification Page</a>
          <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
            Tip: choose &ldquo;Save as PDF&rdquo; in the print dialog to keep a copy on your phone.
          </p>
        </div>
      </div>
    </MemberShell>
  );
}
