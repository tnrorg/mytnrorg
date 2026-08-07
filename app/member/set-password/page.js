'use client';
import { useState, useEffect } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { setToken } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function SetPassword() {
  const [token, setTok] = useState('');
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setTok(t);
    if (!t) { setErr('This link is invalid.'); setLoading(false); return; }
    fetch('/api/member/set-password?token=' + encodeURIComponent(t))
      .then(r => r.json())
      .then(r => { if (r.ok) setInfo(r); else setErr(r.message || 'This link is invalid or expired.'); })
      .catch(() => setErr('Could not verify this link.'))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e) {
    e.preventDefault(); if (busy) return;
    if (pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true); setErr('');
    const r = await fetch('/api/member/set-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: pw }),
    }).then(x => x.json()).catch(() => ({ ok: false, message: 'Network error.' }));
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Could not set your password.');
    setToken(r.token); window.location.href = '/member/dashboard';
  }

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />
      <section className="flex-1 grid place-items-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <img src="/tnr-logo.png" alt="TNR" className="w-16 h-16 mx-auto object-contain" />
          <h1 style={{ ...mont, color: C.deep }} className="mt-4 text-2xl font-black">Set Your Password</h1>

          {loading && <p className="mt-6 text-sm text-gray-400">Verifying your link…</p>}

          {!loading && err && !info && (
            <div className="mt-8 rounded-2xl bg-white border border-red-200 shadow-sm p-6">
              <p className="text-sm text-red-600">{err}</p>
              <a href="/member/login" className="mt-4 inline-block text-sm font-semibold" style={{ color: C.green }}>Go to Member Login</a>
            </div>
          )}

          {info && (
            <>
              <p className="mt-1 text-sm text-gray-500">Welcome, {info.first_name}. Choose a password for {info.email}.</p>
              <form onSubmit={submit} className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">New Password</label>
                  <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
                  <p className="mt-1 text-[11px] text-gray-400">At least 8 characters.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm Password</label>
                  <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button disabled={busy || !pw || !pw2}
                  className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                  style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                  {busy ? '…' : 'Set Password & Continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
