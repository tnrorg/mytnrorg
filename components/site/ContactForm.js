'use client';
import { useState } from 'react';
import { CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { validateContact, kindByKey, LIMITS } from '@/lib/contact';
import { COLORS } from '@/lib/design/tokens';

/* One form behind all four contact pages.
 *
 * The pages differ only in wording and the `kind` they submit. Building four
 * copies of a form is how four forms end up with four different validation
 * rules and three of them quietly broken.
 */
export default function ContactForm({ kind = 'general' }) {
  const meta = kindByKey(kind);

  const [f, setF] = useState({ kind });
  const [errors, setErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fatal, setFatal] = useState('');

  const set = (k) => (e) => {
    const v = e.target.value;
    setF(p => {
      const next = { ...p, [k]: v };
      if (tried) setErrors(validateContact(next));
      return next;
    });
  };
  // Errors appear only after a submit attempt — a wall of red before anyone
  // has typed reads as the form telling them off for arriving.
  const err = (k) => (tried ? errors[k] : '');

  async function submit(e) {
    e.preventDefault();
    setTried(true);
    setFatal('');

    const found = validateContact({ ...f, kind });
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const r = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, kind }),
      });
      const j = await r.json().catch(() => null);
      setBusy(false);

      if (!j?.ok) {
        if (j?.errors) setErrors(j.errors);
        setFatal(j?.message || 'Your message could not be sent. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setBusy(false);
      setFatal('Could not reach the server. Check your connection and try again.');
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border p-6 text-center"
        style={{ borderColor: 'rgba(23,107,73,.25)', background: 'rgba(23,107,73,.06)' }}>
        <CheckCircle2 size={34} className="mx-auto mb-3" style={{ color: COLORS.green700 }} aria-hidden="true" />
        <h2 className="text-lg font-black" style={{ color: COLORS.green900 }}>Message received</h2>
        <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
          Thank you. Your message has been recorded and the committee has been notified.
          {f.email
            ? <> We will reply to <b>{f.email}</b>.</>
            : <> We will reply on the number you gave.</>}
        </p>
        <button type="button"
          onClick={() => { setSent(false); setF({ kind }); setTried(false); setErrors({}); }}
          className="mt-4 text-sm font-bold hover:underline" style={{ color: COLORS.green700 }}>
          Send another message
        </button>
      </div>
    );
  }

  const input = 'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors';
  const style = (bad) => ({
    borderColor: bad ? '#DC2626' : 'rgba(0,0,0,.12)',
    background: '#fff',
  });

  const Field = ({ label, required, error, hint, children }) => (
    <label className="block">
      <span className="block text-xs font-bold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {fatal && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="shrink-0 mt-0.5" aria-hidden="true" />{fatal}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your name" required error={err('name')}>
          <input className={input} style={style(!!err('name'))} value={f.name || ''}
            onChange={set('name')} maxLength={LIMITS.name} autoComplete="name" />
        </Field>
        <Field label="Membership ID" hint="Only if you are a TNR member.">
          <input className={input} style={style(false)} value={f.membership_id || ''}
            onChange={set('membership_id')} maxLength={LIMITS.membership_id}
            placeholder="TNR-MN-0000" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Email address" error={err('email')}
          hint="Give an email or a phone number so we can reply.">
          <input type="email" className={input} style={style(!!err('email'))} value={f.email || ''}
            onChange={set('email')} maxLength={LIMITS.email} autoComplete="email" />
        </Field>
        <Field label="Phone number" error={err('mobile')}>
          <input className={input} style={style(!!err('mobile'))} value={f.mobile || ''}
            onChange={set('mobile')} maxLength={LIMITS.mobile}
            placeholder="03xx xxxxxxx" autoComplete="tel" />
        </Field>
      </div>

      <Field label={meta.subjectLabel} required error={err('subject')}>
        <input className={input} style={style(!!err('subject'))} value={f.subject || ''}
          onChange={set('subject')} maxLength={LIMITS.subject} />
      </Field>

      <Field label="Your message" required error={err('message')}>
        <textarea rows={7} className={input} style={style(!!err('message'))} value={f.message || ''}
          onChange={set('message')} maxLength={LIMITS.message} />
        <span className="mt-1 block text-[11px] text-gray-500 text-right">
          {String(f.message || '').length} / {LIMITS.message}
        </span>
      </Field>

      <button type="submit" disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white
          transition-opacity disabled:opacity-60"
        style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
        <Send size={15} aria-hidden="true" />
        {busy ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Your message goes to the TNR committee. Please do not include passwords or
        bank details — nobody at TNR will ever ask you for them.
      </p>
    </form>
  );
}
