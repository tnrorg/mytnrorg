'use client';
import { useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';

const C = { deep: '#063D2B', green: '#0B6B4F', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const LABEL = {
  pending_review: ['Pending Review', '#B45309', '#FEF3C7'],
  under_review: ['Under Review', '#1D4ED8', '#DBEAFE'],
  correction_requested: ['Correction Requested', '#B45309', '#FEF3C7'],
  approved: ['Approved', '#065F46', '#D1FAE5'],
  rejected: ['Not Approved', '#991B1B', '#FEE2E2'],
  withdrawn: ['Withdrawn', '#6B7280', '#F3F4F6'],
};

export default function StatusPage() {
  const [ref, setRef] = useState(''); const [email, setEmail] = useState('');
  const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function check(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr(''); setRes(null);
    const r = await fetch('/api/public/membership/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_no: ref, email }),
    }).then(x => x.json()).catch(() => ({ ok: false, message: 'Network error.' }));
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'No application found.');
    setRes(r);
  }

  const [txt, fg, bg] = LABEL[res?.status] || ['—', '#374151', '#F3F4F6'];

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />
      <section className="flex-1 max-w-lg w-full mx-auto px-4 py-14">
        <h1 style={{ ...mont, color: C.deep }} className="text-3xl font-black text-center">Check Application Status</h1>
        <p className="mt-2 text-gray-500 text-sm text-center">Enter your reference number and the email you applied with.</p>

        <form onSubmit={check} className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Reference Number</label>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="TNR-MN-0001"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
          </div>
          <button disabled={busy || !ref || !email}
            className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
            {busy ? 'Checking…' : 'Check Status'}
          </button>
          {err && <p className="text-sm text-red-600 text-center">{err}</p>}
        </form>

        {res && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Reference</span>
              <span className="font-mono text-sm font-bold" style={{ color: C.deep }}>{res.reference_no}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">Submitted</span>
              <span className="text-sm">{new Date(res.submitted_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">Status</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ color: fg, background: bg }}>{txt}</span>
            </div>
            {res.admin_message && (
              <div className="mt-4 rounded-xl p-3 text-sm text-gray-600" style={{ background: '#0B6B4F0d' }}>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Message from the committee</div>
                {res.admin_message}
              </div>
            )}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
