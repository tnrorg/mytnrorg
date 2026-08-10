'use client';
import { useState } from 'react';
import { aPost, setToken } from './adminApi';
import { Logo } from '@/components/Brand';
import Turnstile from '@/components/ui/Turnstile';
import { ShieldCheck } from 'lucide-react';

export default function Login({ onIn }) {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [cf, setCf] = useState('');

  /* The second-factor step lives in this same component rather than a route of
   * its own, because the challenge token must never be persisted. It stays in
   * React state and dies with the page — a reload correctly sends the admin
   * back to the password form. Putting it in localStorage would leave a
   * half-finished sign-in lying around for any script on the origin to pick up. */
  const [challenge, setChallenge] = useState(null);   // { token, emailFallback, hint }
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');

  function resetCaptcha() {
    // A used token cannot be replayed, so the widget must be reset before the
    // next attempt or the retry fails on the captcha rather than the password
    // — which reads as "my password stopped working".
    setCf('');
    try { window.turnstile?.reset?.(); } catch {}
  }

  function restart(message) {
    setChallenge(null); setCode(''); setP(''); setNotice('');
    setErr(message || '');
    resetCaptcha();
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await aPost('/api/admin/login', { username: u, password: p, turnstileToken: cf });
    setBusy(false);

    if (!r.ok) { resetCaptcha(); setErr(r.message || 'Login failed'); return; }

    if (r.twoFactorRequired) {
      setChallenge({ token: r.challengeToken, emailFallback: r.emailFallbackAvailable, hint: r.hint });
      setP('');                      // the password has done its job
      return;
    }

    setToken(r.token);
    onIn(r.admin, { enrolRequired: r.enrolRequired });
  }

  async function submitCode(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setNotice('');
    const r = await aPost('/api/admin/login/2fa', { challengeToken: challenge.token, code });
    setBusy(false);

    if (!r.ok) {
      // The server decides when a challenge is beyond saving; the client just
      // obeys, so the two cannot disagree about how many attempts are left.
      if (r.restart) { restart(r.message); return; }
      setErr(r.message || 'Incorrect code.');
      setCode('');
      return;
    }

    setToken(r.token);
    onIn(r.admin, { enrolRequired: r.enrolRequired, usedBackupCode: r.usedBackupCode,
      backupCodesLeft: r.backupCodesLeft });
  }

  async function emailCode() {
    setBusy(true); setErr(''); setNotice('');
    const r = await aPost('/api/admin/login/2fa/email', { challengeToken: challenge.token });
    setBusy(false);
    if (!r.ok) {
      if (r.restart) { restart(r.message); return; }
      setErr(r.message || 'Could not send a code.');
      return;
    }
    setNotice(`Code sent to ${challenge.hint || 'your recovery email'}.`);
  }

  const shell = (children) => (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card p-8 w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Logo size={64} />
          <h1 className="text-xl font-bold">TNR Admin</h1>
          <p className="text-xs text-tnr-cream/50">Tehreek-e-Nojawanan Roundu</p>
        </div>
        {children}
      </div>
    </div>
  );

  if (challenge) {
    return shell(
      <form onSubmit={submitCode}>
        <div className="flex items-center gap-2 justify-center mb-1 text-tnr-gold">
          <ShieldCheck size={16} />
          <span className="text-sm font-semibold">Verification</span>
        </div>
        <p className="text-xs text-tnr-cream/60 text-center mb-4">
          Enter the 6-digit code from your authenticator app.
        </p>

        <input
          className="input mb-3 text-center text-2xl tracking-[0.4em] font-mono"
          value={code}
          // Backup codes are letters, app codes are digits — so the field
          // accepts both rather than making the admin find a different box at
          // the exact moment they have lost their phone.
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 9))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        />

        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        {notice && <p className="text-emerald-400 text-sm mb-3">{notice}</p>}

        <button className="btn-gold w-full mb-3" disabled={busy || code.length < 6}>
          {busy ? '…' : 'Verify'}
        </button>

        <div className="text-center space-y-1">
          <p className="text-xs text-tnr-cream/40">
            Lost your phone? Type one of your backup codes above.
          </p>
          {challenge.emailFallback && (
            <button type="button" onClick={emailCode} disabled={busy}
              className="text-xs text-tnr-gold hover:underline">
              Or email a code to {challenge.hint}
            </button>
          )}
          <div>
            <button type="button" onClick={() => restart()}
              className="text-xs text-tnr-cream/40 hover:text-tnr-cream/70">
              Start over
            </button>
          </div>
        </div>
      </form>
    );
  }

  return shell(
    <form onSubmit={submit}>
      <input className="input mb-3" placeholder="Username" value={u}
        onChange={(e) => setU(e.target.value)} autoFocus />
      <input className="input mb-3" type="password" placeholder="Password" value={p}
        onChange={(e) => setP(e.target.value)} />
      <Turnstile onToken={setCf} theme="dark" className="mb-3" />
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      {/* The default credentials used to be printed here. A public sign-in
          page should never advertise a working username and password — the
          hint only helped whoever set the site up, once, and helped everyone
          else every day after that. */}
      <button className="btn-gold w-full" disabled={busy}>{busy ? '…' : 'Sign in'}</button>
    </form>
  );
}
