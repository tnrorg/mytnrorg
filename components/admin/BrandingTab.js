'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';
import { Card, Field } from './ui';

/**
 * Edit the header lines that appear on every email the site sends.
 * Shows a live preview of the actual email header so the wording can be judged
 * in place rather than guessed from a form field.
 */
export default function BrandingTab({ toast }) {
  const [f, setF] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [busy, setBusy] = useState(false);

  const load = () =>
    aGet('/api/admin/branding').then(r => {
      if (r.ok) { setF(r.branding); setDefaults(r.defaults || {}); }
      else toast(r.message || 'Could not load branding.', 'err');
    });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    const r = await aPatch('/api/admin/branding', f);
    setBusy(false);
    if (!r.ok) return toast(r.message || 'Could not save.', 'err');
    toast('Email branding updated. New messages use it immediately.');
    load();
  }

  function reset() {
    setF({ ...defaults });
  }

  if (!f) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  return (
    <div className="space-y-5 max-w-3xl">
      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Email Branding</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">
          These lines appear at the top of every email TNR sends — verification codes,
          membership invitations and notices. Changes apply within a minute; no redeploy needed.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Header title">
            <input className="input" value={f.email_brand_title || ''}
              onChange={set('email_brand_title')} maxLength={60} />
          </Field>
          <Field label="Header subtitle">
            <input className="input" value={f.email_brand_subtitle || ''}
              onChange={set('email_brand_subtitle')} maxLength={60} />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Footer note">
            <input className="input" value={f.email_footer_note || ''}
              onChange={set('email_footer_note')} maxLength={200} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-tnr-gold text-tnr-green disabled:opacity-40">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={reset} type="button"
            className="text-sm text-tnr-cream/60 hover:text-tnr-cream hover:underline">
            Reset to defaults
          </button>
          <span className="text-[11px] text-tnr-cream/40">
            Leaving a field blank restores its default.
          </span>
        </div>
      </Card>

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Preview</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">How this will look in a member&rsquo;s inbox.</p>
        <div style={{
          fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: 560, margin: '0 auto',
          border: '1px solid #eee', borderRadius: 16, overflow: 'hidden', background: '#fff',
        }}>
          <div style={{ background: '#063D2B', color: '#fff', padding: '22px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, letterSpacing: 2, color: '#D4A72C', fontWeight: 700 }}>
              {f.email_brand_title || defaults.email_brand_title}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {f.email_brand_subtitle || defaults.email_brand_subtitle}
            </div>
          </div>
          <div style={{ padding: '26px 24px', color: '#15231D' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 19, color: '#063D2B' }}>Welcome to TNR</h2>
            <p style={{ margin: '0 0 14px', lineHeight: 1.65, color: '#333', fontSize: 14 }}>
              Your membership application has been approved. Your membership number is TNR-MN-0001.
            </p>
          </div>
          <div style={{ background: '#FAFAFA', padding: '14px 24px', textAlign: 'center', color: '#aaa', fontSize: 11 }}>
            {f.email_footer_note || defaults.email_footer_note}
          </div>
        </div>
      </Card>
    </div>
  );
}
