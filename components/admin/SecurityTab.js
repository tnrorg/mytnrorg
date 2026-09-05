'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, setToken } from './adminApi';
import { Card, Toast } from './ui';
import TwoFactorSetup from './TwoFactorSetup';
import { ShieldCheck, ShieldOff, Mail, KeyRound, Lock } from 'lucide-react';

/* The admin's own security settings. Deliberately scoped to the signed-in
 * account only — there is no "disable 2FA for another admin" control here,
 * because that would be a way for one compromised admin to strip the second
 * factor from everyone else. Recovering a genuinely locked-out colleague is a
 * database operation, and it should be.
 */
export default function SecurityTab() {
  const [st, setSt] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [pw, setPw] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await aGet('/api/admin/2fa/status');
    if (r.ok) setSt(r);
  }
  useEffect(() => { load(); }, []);

  async function saveEmail(e) {
    e.preventDefault();
    setBusy(true);
    const r = await aPost('/api/admin/2fa/status', { email });
    setBusy(false);
    setToast({ msg: r.ok ? 'Recovery email saved.' : (r.message || 'Could not save.'), tone: r.ok ? 'ok' : 'err' });
    if (r.ok) { setEmail(''); load(); }
  }

  async function disable(e) {
    e.preventDefault();
    setBusy(true);
    const r = await aPost('/api/admin/2fa/disable', { password: pw });
    setBusy(false);
    setPw('');
    setToast({ msg: r.ok ? 'Two-factor authentication turned off.' : (r.message || 'Failed.'), tone: r.ok ? 'ok' : 'err' });
    if (r.ok) { setShowDisable(false); load(); }
  }

  if (!st) return <p className="text-tnr-cream/50 text-sm">Loading…</p>;

  if (!st.available) {
    return <Card><p className="text-sm text-tnr-cream/70">{st.message}</p></Card>;
  }

  if (enrolling) {
    return <TwoFactorSetup
      forced={st.enrolRequired}
      onCancel={() => setEnrolling(false)}
      onDone={() => { setEnrolling(false); load(); }} />;
  }

  return (
    <div className="space-y-4 max-w-lg">
      {toast && <Toast msg={toast.msg} tone={toast.tone} onDone={() => setToast(null)} />}

      <ChangePassword onDone={(msg, tone) => setToast({ msg, tone })} />

      <Card>
        <div className="flex items-start gap-3">
          {st.enabled
            ? <ShieldCheck className="text-emerald-400 shrink-0" size={22} />
            : <ShieldOff className="text-tnr-cream/40 shrink-0" size={22} />}
          <div className="flex-1">
            <h3 className="font-bold mb-1">Two-factor authentication</h3>
            <p className="text-sm text-tnr-cream/70 mb-3">
              {st.enabled
                ? 'On. Sign-in needs your password and a code from your authenticator app.'
                : 'Off. Your password alone signs you in.'}
            </p>

            {st.enabled ? (
              <div className="space-y-2">
                <p className="text-xs text-tnr-cream/50 flex items-center gap-2">
                  <KeyRound size={13} />
                  {st.backupCodesLeft} backup code{st.backupCodesLeft === 1 ? '' : 's'} remaining
                  {st.backupCodesLeft <= 2 &&
                    <span className="text-tnr-gold">— turn 2FA off and on again for a fresh set</span>}
                </p>
                {!showDisable ? (
                  <button className="btn-ghost text-sm" onClick={() => setShowDisable(true)}>
                    Turn off / change device
                  </button>
                ) : (
                  <form onSubmit={disable} className="pt-2">
                    <p className="text-xs text-tnr-cream/60 mb-2">
                      Confirm your password. This also clears your backup codes.
                    </p>
                    <input className="input mb-2" type="password" placeholder="Current password"
                      value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
                    <div className="flex gap-2">
                      <button className="btn-ghost text-sm" disabled={busy || !pw}>Confirm</button>
                      <button type="button" className="btn-ghost text-sm"
                        onClick={() => { setShowDisable(false); setPw(''); }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <button className="btn-gold text-sm" onClick={() => setEnrolling(true)}>
                {st.enrolRequired ? 'Set up now (required)' : 'Set up'}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Mail className="text-tnr-cream/40 shrink-0" size={20} />
          <div className="flex-1">
            <h3 className="font-bold mb-1 text-sm">Recovery email</h3>
            <p className="text-xs text-tnr-cream/60 mb-3">
              {st.hasRecoveryEmail
                ? <>Codes can be sent to <b>{st.recoveryEmail}</b> if you lose your phone.</>
                : 'Not set. Without one, backup codes are your only way back in.'}
            </p>
            {/* Said plainly rather than buried: an emailed code is weaker than
                the app, because whoever holds the mailbox can complete the
                sign-in. Worth knowing before relying on it. */}
            <p className="text-xs text-tnr-cream/40 mb-3">
              An emailed code is weaker than the app — anyone with access to that
              mailbox could use it. Prefer your backup codes.
            </p>
            <form onSubmit={saveEmail} className="flex gap-2">
              <input className="input flex-1 text-sm" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn-ghost text-sm" disabled={busy}>Save</button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* Changing your own password.
 *
 * FIRST, not last, on this screen. A password is the credential every admin
 * actually has; two-factor is the one some of them have set up. Putting the
 * universal thing below the optional thing is how a control goes unused.
 */
function ChangePassword({ onDone }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const MIN = 10;
  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = again.length > 0 && next !== again;
  const ready = cur && next.length >= MIN && next === again && !busy;

  function reset() {
    setCur(''); setNext(''); setAgain(''); setErr(''); setOpen(false);
  }

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await aPost('/api/admin/password', {
      current_password: cur, new_password: next,
    });
    setBusy(false);

    if (!r?.ok) {
      setErr([r?.message, r?.detail].filter(Boolean).join(' '));
      return;
    }

    /* Keep THIS device signed in.
     *
     * The change revokes every session including the one that made it, so
     * without swapping in the fresh token the admin is thrown out the instant
     * they succeed — which reads as a failure and teaches people not to do it.
     */
    if (r.token) setToken(r.token);
    reset();
    onDone?.(r.message, 'ok');
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Lock className="text-tnr-cream/50 shrink-0" size={22} />
        <div className="flex-1">
          <h3 className="font-bold mb-1">Your password</h3>
          <p className="text-sm text-tnr-cream/70 mb-3">
            Change it yourself — nobody else sees it, not even a super admin.
            Every other device you are signed in on is signed out at the same time.
          </p>

          {!open && (
            <button onClick={() => setOpen(true)} className="btn btn-ghost text-sm">
              Change password
            </button>
          )}

          {open && (
            <form onSubmit={submit} className="space-y-2">
              <input className="input" type="password" autoComplete="current-password"
                placeholder="Current password" value={cur}
                onChange={e => { setCur(e.target.value); setErr(''); }} />

              <input className="input" type="password" autoComplete="new-password"
                placeholder={`New password (at least ${MIN} characters)`} value={next}
                onChange={e => { setNext(e.target.value); setErr(''); }} />
              {tooShort && (
                <p className="text-[12px] text-amber-300">
                  {MIN - next.length} more character{MIN - next.length === 1 ? '' : 's'} needed.
                </p>
              )}

              <input className="input" type="password" autoComplete="new-password"
                placeholder="New password again" value={again}
                onChange={e => { setAgain(e.target.value); setErr(''); }} />
              {mismatch && (
                <p className="text-[12px] text-amber-300">The two do not match.</p>
              )}

              {err && <p className="text-[12.5px] text-red-300">{err}</p>}

              <p className="text-[11.5px] text-tnr-cream/40">
                A short phrase you can remember is stronger than a short jumble you
                cannot. Length is what resists guessing.
              </p>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={!ready} className="btn btn-primary text-sm disabled:opacity-40">
                  {busy ? 'Changing…' : 'Change password'}
                </button>
                <button type="button" onClick={reset} className="btn btn-ghost text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}

