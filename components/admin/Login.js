'use client';
import { useState } from 'react';
import { aPost, setToken } from './adminApi';
import { Logo } from '@/components/Brand';
export default function Login({ onIn }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setErr('');
    const r = await aPost('/api/admin/login', { username: u, password: p }); setBusy(false);
    if (!r.ok) { setErr(r.message || 'Login failed'); return; }
    setToken(r.token); onIn(r.admin);
  }
  return <div className="min-h-screen grid place-items-center px-4">
    <form onSubmit={submit} className="card p-8 w-full max-w-sm animate-fade-up">
      <div className="flex flex-col items-center gap-2 mb-6"><Logo size={64} />
        <h1 className="text-xl font-bold">TNR Admin</h1><p className="text-xs text-tnr-cream/50">Tehreek-e-Nojawanan Roundu</p></div>
      <input className="input mb-3" placeholder="Username" value={u} onChange={e => setU(e.target.value)} autoFocus />
      <input className="input mb-3" type="password" placeholder="Password" value={p} onChange={e => setP(e.target.value)} />
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? '…' : 'Sign in'}</button>
      <p className="text-[11px] text-tnr-cream/40 mt-4 text-center">Default: admin / admin123 — change after first login.</p>
    </form>
  </div>;
}
