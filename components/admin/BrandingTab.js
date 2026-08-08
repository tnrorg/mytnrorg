'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';
import { Card, Field } from './ui';
import { SOCIALS, normaliseUrl } from '@/lib/siteHeader';

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
    toast('Saved. The top bar updates on the next page load; emails use it immediately.');
    load();
  }

  function reset() {
    setF({ ...defaults });
  }

  if (!f) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Site header ─────────────────────────────────────────────────── */}
      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Top Bar</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">
          The thin dark strip above the main navigation, on every page of the site.
        </p>

        <Field label="Tagline">
          <input className="input" value={f.header_tagline || ''}
            onChange={set('header_tagline')} maxLength={120} />
        </Field>

        <div className="mt-2">
          <span className="label">Social links</span>
          <p className="text-[11px] text-tnr-cream/40 mb-2">
            Paste the full page address. Leave one blank to hide that icon —
            better than linking to an account you do not have.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SOCIALS.map(([key, chip, name]) => {
              const href = normaliseUrl(f[key]);
              return (
                <div key={key}>
                  <label className="flex items-center gap-2">
                    <span className="w-6 h-6 shrink-0 rounded grid place-items-center bg-white/10 text-[10px] font-bold text-tnr-cream/70">
                      {chip}
                    </span>
                    <input className="input flex-1" placeholder={`${name} page URL`}
                      value={f[key] || ''} onChange={set(key)} maxLength={300} />
                  </label>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="ml-8 mt-1 inline-block text-[11px] text-tnr-goldLight hover:underline break-all">
                      {href}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

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
