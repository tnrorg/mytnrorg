'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from './adminApi';
import { Card, Toast } from './ui';
import TwoFactorSetup from './TwoFactorSetup';
import { ShieldCheck, ShieldOff, Mail, KeyRound } from 'lucide-react';

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
