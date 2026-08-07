'use client';
import { useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { setToken, clearToken } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function MemberLogin() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false); const [sent, setSent] = useState('');

  async function login(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/member/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(x => x.json()).catch(() => ({ ok: false, message: 'Network error.' }));
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Invalid email or password.');
    if (!r.token) return setErr('Sign-in failed: no session was issued. Please contact support.');

    // Store the token, then VERIFY it works before navigating. Without this a
    // rejected token silently bounces the member back here with no explanation.
    setToken(r.token);
    const check = await fetch('/api/member/me', {
      headers: { Authorization: 'Bearer ' + r.token }, cache: 'no-store',
    }).then(x => x.json()).catch(() => ({ ok: false, message: 'Network error.' }));

    if (!check.ok) {
      clearToken();
      return setErr('Signed in, but your session was rejected: ' + (check.message || 'unknown reason'));
    }
    window.location.href = '/member/dashboard';
  }

  async function reset(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/member/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(x => x.json()).catch(() => ({}));
    setBusy(false);
    setSent(r.message || 'If an account exists for that email, a reset link has been sent.');
  }

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />
      <section className="flex-1 grid place-items-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <img src="/tnr-logo.png" alt="TNR" className="w-16 h-16 mx-auto object-contain" />
            <h1 style={{ ...mont, color: C.deep }} className="mt-4 text-2xl font-black">Member Login</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to your TNR Member Portal.</p>
          </div>

          {sent ? (
            <div className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
              <div className="text-3xl">📧</div>
              <p className="mt-3 text-sm text-gray-600">{sent}</p>
              <button onClick={() => { setForgot(false); setSent(''); }} className="mt-5 text-sm font-semibold" style={{ color: C.green }}>← Back to login</button>
            </div>
          ) : (
            <form onSubmit={forgot ? reset : login} className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
              </div>
              {!forgot && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
                </div>
              )}
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button disabled={busy || !email || (!forgot && !password)}
                className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                {busy ? '…' : forgot ? 'Send Reset Link' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { setForgot(!forgot); setErr(''); }}
                className="w-full text-xs text-gray-500 hover:underline">
                {forgot ? '← Back to login' : 'Forgot your password?'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            Not a member yet? <a href="/membership/apply" className="font-semibold" style={{ color: C.green }}>Apply for membership</a>
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
