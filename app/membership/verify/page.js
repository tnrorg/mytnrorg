'use client';
import { useEffect, useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const TONE = {
  'Verified and Active': ['#065F46', '#D1FAE5', '✅'],
  Suspended: ['#92400E', '#FEF3C7', '⚠️'],
  Inactive: ['#374151', '#F3F4F6', '⏸️'],
  Expired: ['#374151', '#F3F4F6', '⌛'],
  'Not Found': ['#991B1B', '#FEE2E2', '❌'],
};

export default function VerifyPage() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (value) => {
    const v = (value ?? q).trim();
    if (!v || busy) return;
    setBusy(true); setErr(''); setRes(null);
    const r = await fetch('/api/public/verify?id=' + encodeURIComponent(v))
      .then(x => x.json()).catch(() => ({ ok: false, message: 'Network error.' }));
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Could not verify.');
    setRes(r);
  };

  // Support /membership/verify?id=TNR-0001 from the QR code.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) { setQ(id); run(id); }
    // eslint-disable-next-line
  }, []);

  const [fg, bg, icon] = TONE[res?.state] || TONE['Not Found'];

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: '#15231D', ...mont }}>
      <SiteNav />
      <section className="flex-1 max-w-lg w-full mx-auto px-4 py-14">
        <h1 style={{ ...mont, color: C.deep }} className="text-3xl font-black text-center">Verify Membership</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">
          Enter a Membership ID or certificate number to confirm it is genuine.
        </p>

        <form onSubmit={e => { e.preventDefault(); run(); }}
          className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="TNR-0001"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-center font-mono outline-none focus:border-[#0B6B4F]" />
          <button disabled={busy || !q.trim()} className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          {err && <p className="text-sm text-red-600 text-center">{err}</p>}
        </form>

        {res && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden">
            <div className="px-6 py-5 text-center" style={{ background: bg }}>
              <div className="text-3xl">{icon}</div>
              <div className="mt-1 font-black" style={{ color: fg }}>{res.state}</div>
            </div>

            {res.found ? (
              <div className="p-6">
                <div className="flex items-center gap-4">
                  {res.photo_url && (
                    <img src={res.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                  )}
                  <div className="min-w-0">
                    <div style={{ ...mont, color: C.deep }} className="text-lg font-black">{res.full_name}</div>
                    <div className="font-mono text-xs" style={{ color: C.green }}>{res.membership_id}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {[['Category', res.category], ['Village', res.village],
                    ['Union Council', res.union_council],
                    ['Issued', res.issued_at && new Date(res.issued_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })],
                    ['Expires', res.expires_at && new Date(res.expires_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })],
                    ['Certificate', res.certificate_no]].map(([k, v]) => v ? (
                    <div key={k} className="flex justify-between gap-3 border-b border-gray-50 pb-1.5">
                      <span className="text-gray-400 text-xs">{k}</span>
                      <span className="font-medium text-right">{v}</span>
                    </div>) : null)}
                </div>
                {res.valid && (
                  <div className="mt-5 text-center text-xs font-bold px-3 py-2 rounded-xl"
                    style={{ background: '#0B6B4F14', color: C.deep }}>✔ VERIFIED TNR MEMBER</div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                No membership record matches that number. Please check and try again.
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-gray-400">
          For privacy, only membership status and basic details are shown. Contact information is never displayed.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
