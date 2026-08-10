'use client';
import { useState } from 'react';
import { aPost, clearToken } from './adminApi';
import { ShieldCheck, Smartphone, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';

/* Enrolment wizard: scan → confirm → write down backup codes.
 *
 * The third step is not decoration. Backup codes are shown exactly once and
 * cannot be retrieved afterwards, so the screen refuses to close until the
 * admin ticks that they have saved them. An admin who skips past it and later
 * loses their phone becomes a database repair job.
 */
export default function TwoFactorSetup({ onDone, onCancel, forced = false }) {
  const [step, setStep] = useState('start');       // start | scan | codes
  const [data, setData] = useState(null);          // { secret, uri, qr }
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState([]);
  const [reauth, setReauth] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true); setErr('');
    const r = await aPost('/api/admin/2fa/setup', {});
    setBusy(false);
    if (!r.ok) { setErr(r.message || 'Could not start setup.'); return; }
    setData(r); setStep('scan');
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await aPost('/api/admin/2fa/confirm', { code });
    setBusy(false);
    if (!r.ok) { setErr(r.message || 'That code did not match.'); setCode(''); return; }
    setCodes(r.backupCodes || []);
    setReauth(!!r.reauthRequired);
    setStep('codes');
  }

  function finish() {
    if (reauth) {
      // The current token was signed before enrolment and still says this
      // session has no second factor. Clearing it drops straight back to the
      // sign-in form, where the new factor gets its first real use.
      clearToken();
      try { window.dispatchEvent(new Event('tnr-logout')); } catch {}
      return;
    }
    onDone?.();
  }

  function copyCodes() {
    try {
      navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the codes are on screen to copy by hand */ }
  }

  return (
    <div className="card p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <ShieldCheck className="text-tnr-gold" size={22} />
        <h3 className="text-lg font-bold">Two-factor authentication</h3>
      </div>

      {step === 'start' && (
        <div>
          <p className="text-sm text-tnr-cream/70 mb-4">
            After this, signing in needs your password <em>and</em> a 6-digit code from your
            phone. Someone who learns your password still cannot get in.
          </p>
          {forced && (
            <div className="flex gap-2 items-start rounded-lg bg-tnr-gold/10 border border-tnr-gold/30 p-3 mb-4">
              <AlertTriangle size={16} className="text-tnr-gold mt-0.5 shrink-0" />
              <p className="text-xs text-tnr-cream/80">
                Required for super admin accounts — these can read every member record.
              </p>
            </div>
          )}
          <p className="text-xs text-tnr-cream/50 mb-4">
            You will need an authenticator app: Google Authenticator, Microsoft Authenticator
            or Authy. All are free.
          </p>
          {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
          <div className="flex gap-2">
            <button className="btn-gold" onClick={begin} disabled={busy}>
              {busy ? '…' : 'Begin setup'}
            </button>
            {!forced && onCancel && (
              <button className="btn-ghost" onClick={onCancel}>Not now</button>
            )}
          </div>
        </div>
      )}

      {step === 'scan' && data && (
        <form onSubmit={confirm}>
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <Smartphone size={16} className="text-tnr-gold" /> Step 1 — scan this
          </div>

          <div className="flex justify-center mb-4">
            {/* Rendered by our own server. The secret in this URI is never sent
                to an external image service. */}
            <img src={data.qr} alt="Setup QR code" width={200} height={200}
              className="rounded-lg bg-white p-2" />
          </div>

          <details className="mb-4">
            <summary className="text-xs text-tnr-cream/50 cursor-pointer hover:text-tnr-cream/80">
              Can't scan? Enter this key by hand
            </summary>
            <code className="block mt-2 text-xs bg-black/30 rounded p-2 break-all tracking-wider">
              {data.secret}
            </code>
          </details>

          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
            <KeyRound size={16} className="text-tnr-gold" /> Step 2 — type the code it shows
          </div>
          <input
            className="input mb-3 text-center text-2xl tracking-[0.4em] font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
          <button className="btn-gold w-full" disabled={busy || code.length !== 6}>
            {busy ? '…' : 'Turn on two-factor authentication'}
          </button>
        </form>
      )}

      {step === 'codes' && (
        <div>
          <div className="flex gap-2 items-start rounded-lg bg-red-500/10 border border-red-500/30 p-3 mb-4">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-tnr-cream/90">
              <b>Save these now.</b> They are shown once and cannot be recovered.
              Each one signs you in a single time if you lose your phone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-sm">
            {codes.map((c) => (
              <div key={c} className="bg-black/30 rounded px-3 py-2 text-center tracking-wider">{c}</div>
            ))}
          </div>

          <button type="button" onClick={copyCodes}
            className="btn-ghost w-full mb-4 flex items-center justify-center gap-2 text-sm">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy all</>}
          </button>

          <label className="flex items-start gap-2 mb-4 cursor-pointer text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)}
              className="mt-1" />
            <span className="text-tnr-cream/80">
              I have saved these somewhere safe — not on the phone running the authenticator app.
            </span>
          </label>

          <button className="btn-gold w-full" disabled={!saved} onClick={finish}>
            {reauth ? 'Done — sign in again' : 'Done'}
          </button>
          {reauth && (
            <p className="text-xs text-tnr-cream/40 text-center mt-2">
              You'll sign in once more to activate the new factor.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
