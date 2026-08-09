'use client';
import { useState } from 'react';
import { aPost, setToken } from './adminApi';
import { Logo } from '@/components/Brand';
import Turnstile from '@/components/ui/Turnstile';
export default function Login({ onIn }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [cf, setCf] = useState('');
  async function submit(e) { e.preventDefault(); setBusy(true); setErr('');
    const r = await aPost('/api/admin/login', { username: u, password: p, turnstileToken: cf }); setBusy(false);
    if (!r.ok) {
      // A used token cannot be replayed, so the widget must be reset before
      // the next attempt or the retry fails on the captcha rather than the
      // password — which reads as "my password stopped working".
      setCf('');
      try { window.turnstile?.reset?.(); } catch {}
      setErr(r.message || 'Login failed'); return;
    }
    setToken(r.token); onIn(r.admin);
  }
  return <div className="min-h-screen grid place-items-center px-4">
    <form onSubmit={submit} className="card p-8 w-full max-w-sm animate-fade-up">
      <div className="flex flex-col items-center gap-2 mb-6"><Logo size={64} />
        <h1 className="text-xl font-bold">TNR Admin</h1><p className="text-xs text-tnr-cream/50">Tehreek-e-Nojawanan Roundu</p></div>
      <input className="input mb-3" placeholder="Username" value={u} onChange={e => setU(e.target.value)} autoFocus />
      <input className="input mb-3" type="password" placeholder="Password" value={p} onChange={e => setP(e.target.value)} />
      <Turnstile onToken={setCf} theme="dark" className="mb-3" />
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      {/* The default credentials used to be printed here. A public sign-in
          page should never advertise a working username and password — the
          hint only helped whoever set the site up, once, and helped everyone
          else every day after that. */}
      <button className="btn-gold w-full" disabled={busy}>{busy ? '…' : 'Sign in'}</button>
    </form>
  </div>;
}
