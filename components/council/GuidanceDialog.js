'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { COLORS, FONT } from '@/lib/design/tokens';

const CATEGORIES = ['Education & Admissions', 'Career Guidance', 'Research & Publications',
  'Scholarships', 'Entrepreneurship', 'Community Work', 'Other'];
const CONTACT = ['In-app reply', 'Email', 'WhatsApp', 'Phone call'];

/** Guidance request form. Members only — there is deliberately no direct
 *  messaging, so a request has to be accepted before any conversation starts. */
export default function GuidanceDialog({ open, onClose, slug, memberName }) {
  const [f, setF] = useState({ subject: '', category: '', message: '', preferred_contact: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  // Escape to close, and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  const set = (k) => (e) => { setErr(''); setF(s => ({ ...s, [k]: e.target.value })); };
  const ready = f.subject.trim() && f.category && f.message.trim().length >= 20;

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/member/guidance/${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      }).then(x => x.json());
      if (!r?.ok) {
        setErr(r?.message || 'Could not send your request.');
      } else setSent(true);
    } catch { setErr('Network error. Please try again.'); }
    setBusy(false);
  }

  const input = 'w-full rounded-tnr border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#176B49] bg-white';

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center p-0 sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="guidance-title" style={FONT}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-tnr-xl sm:rounded-tnr-xl bg-white p-6">
        <button onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
          <X size={18} strokeWidth={2.2} />
        </button>

        {sent ? (
          <div className="text-center py-8">
            <div className="text-4xl" aria-hidden="true">✅</div>
            <h2 className="mt-3 text-lg font-extrabold" style={{ color: COLORS.green900 }}>Request sent</h2>
            <p className="mt-1.5 text-sm" style={{ color: COLORS.muted }}>
              {memberName} will review your request. You will be notified when they respond —
              no contact details are shared until they accept.
            </p>
            <button onClick={onClose}
              className="mt-6 rounded-tnr px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: COLORS.green700 }}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 id="guidance-title" className="text-lg font-extrabold" style={{ color: COLORS.green900 }}>
                Request Guidance
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: COLORS.muted }}>
                Your request goes to {memberName} for review. They choose whether to accept and reply.
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Subject</span>
              <input className={input + ' mt-1.5'} value={f.subject} onChange={set('subject')}
                placeholder="e.g. Guidance on postgraduate applications" />
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Category</span>
                <select className={input + ' mt-1.5'} value={f.category} onChange={set('category')}>
                  <option value="">— select —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Preferred reply</span>
                <select className={input + ' mt-1.5'} value={f.preferred_contact} onChange={set('preferred_contact')}>
                  <option value="">— no preference —</option>
                  {CONTACT.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Your message</span>
              <textarea rows={5} className={input + ' mt-1.5 leading-relaxed'} value={f.message} onChange={set('message')}
                placeholder="Briefly explain what you would like guidance on." />
              <span className="mt-1 block text-[11px]" style={{ color: COLORS.muted }}>
                {f.message.trim().length < 20
                  ? `${20 - f.message.trim().length} more characters needed`
                  : 'Looks good'}
              </span>
            </label>

            {err && <div className="rounded-tnr bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3" role="alert">{err}</div>}

            <button type="submit" disabled={!ready || busy}
              className="w-full rounded-tnr py-3.5 font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed
                transition-transform duration-micro hover:-translate-y-[1px]"
              style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
              {busy ? 'Sending…' : 'Send Request'}
            </button>
            <p className="text-[11px] text-center" style={{ color: COLORS.muted }}>
              You must be signed in as a TNR member to send a request.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
