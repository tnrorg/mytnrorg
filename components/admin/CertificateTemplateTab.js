'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';
import { Card, Field } from './ui';
import MediaUpload from './MediaUpload';
import { CERT_DEFAULTS, CERT_TOKENS, fillCertificate } from '@/lib/certificateDefaults';

/**
 * Membership certificate template — same shape as the Card Template screen.
 *
 * The preview renders the real certificate layout at 40% scale using a sample
 * member, so the wording can be judged in place. Editing prose in a bare
 * textarea and hoping is how you end up with "of , Union Council ," in print.
 */
const SAMPLE = {
  full_name: 'Ali Hussain',
  membership_id: 'TNR-MN-0001',
  village: 'Harpo',
  union_council: 'Roundu',
  memberPhrase: 'General Member',
  memberType: 'General Member',
};

export default function CertificateTemplateTab({ toast }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    aGet('/api/admin/certificate-settings').then(r => {
      if (r.ok) setF({ ...CERT_DEFAULTS, ...(r.settings || {}) });
      else toast(r.message || r.hint || 'Could not load the template.', 'err');
    });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const toggle = k => () => setF(s => ({ ...s, [k]: !s[k] }));

  async function save() {
    setBusy(true);
    const r = await aPatch('/api/admin/certificate-settings', f);
    setBusy(false);
    if (!r.ok) return toast(r.message || r.hint || 'Could not save.', 'err');
    toast('Certificate template saved.');
    load();
  }

  if (!f) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  const GOLD = f.accent_gold || CERT_DEFAULTS.accent_gold;
  const GREEN = f.accent_green || CERT_DEFAULTS.accent_green;

  return (
    <div className="space-y-5 max-w-5xl">

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Masthead</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">The organisation lines and logo at the top of the certificate.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Organisation line 1">
            <input className="input" value={f.org_line1 || ''} onChange={set('org_line1')} maxLength={80} />
          </Field>
          <Field label="Organisation line 2">
            <input className="input" value={f.org_line2 || ''} onChange={set('org_line2')} maxLength={80} />
          </Field>
        </div>
        <Field label="Logo (leave empty to use the site logo)">
          <MediaUpload folder="certificates" accept="image/*" value={f.logo_url}
            onChange={({ data, url }) => setF(s => ({ ...s, logo_data: data, logo_url: url }))}
            onError={m => toast(m, 'err')} />
        </Field>
      </Card>

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Wording</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">
          The body text supports tokens, replaced with each member&rsquo;s details when their
          certificate is generated.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Certificate title">
            <input className="input" value={f.cert_title || ''} onChange={set('cert_title')} maxLength={80} />
          </Field>
          <Field label="Intro line">
            <input className="input" value={f.intro_line || ''} onChange={set('intro_line')} maxLength={80} />
          </Field>
        </div>
        <Field label="Body text">
          <textarea className="input leading-relaxed" rows={4}
            value={f.body_text || ''} onChange={set('body_text')} maxLength={600} />
        </Field>
        <div className="flex flex-wrap gap-2 -mt-1">
          {CERT_TOKENS.map(([tok, desc]) => (
            <button key={tok} type="button" title={desc}
              onClick={() => setF(s => ({ ...s, body_text: `${s.body_text || ''}${tok}` }))}
              className="rounded-lg border border-tnr-line px-2 py-1 font-mono text-[11px] text-tnr-goldLight hover:bg-white/5">
              {tok}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Signature &amp; footer</h3>
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <Field label="Signatory title">
            <input className="input" value={f.signatory_title || ''} onChange={set('signatory_title')} maxLength={60} />
          </Field>
          <Field label="Signatory organisation">
            <input className="input" value={f.signatory_org || ''} onChange={set('signatory_org')} maxLength={80} />
          </Field>
          <Field label="QR caption">
            <input className="input" value={f.scan_label || ''} onChange={set('scan_label')} maxLength={40} />
          </Field>
          <Field label="Issue-date label">
            <input className="input" value={f.issued_label || ''} onChange={set('issued_label')} maxLength={40} />
          </Field>
        </div>
        <Field label="Signature image">
          <MediaUpload folder="certificates" accept="image/*" value={f.signature_url}
            onChange={({ data, url }) => setF(s => ({ ...s, signature_data: data, signature_url: url }))}
            onError={m => toast(m, 'err')} />
        </Field>
        <p className="text-[11px] text-tnr-cream/40 -mt-2">
          A PNG with a transparent background prints best — a white box around the signature
          shows against the certificate.
        </p>
      </Card>

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Appearance</h3>
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <Field label="Gold accent">
            <div className="flex items-center gap-2">
              <input type="color" value={GOLD} onChange={set('accent_gold')}
                className="h-9 w-12 rounded border border-tnr-line bg-transparent" />
              <input className="input flex-1 font-mono" value={f.accent_gold || ''} onChange={set('accent_gold')} />
            </div>
          </Field>
          <Field label="Green accent">
            <div className="flex items-center gap-2">
              <input type="color" value={GREEN} onChange={set('accent_green')}
                className="h-9 w-12 rounded border border-tnr-line bg-transparent" />
              <input className="input flex-1 font-mono" value={f.accent_green || ''} onChange={set('accent_green')} />
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-5 mt-2">
          <label className="flex items-center gap-2 text-sm text-tnr-cream/80">
            <input type="checkbox" checked={f.show_border !== false} onChange={toggle('show_border')} />
            Decorative border
          </label>
          <label className="flex items-center gap-2 text-sm text-tnr-cream/80">
            <input type="checkbox" checked={f.show_qr !== false} onChange={toggle('show_qr')} />
            Verification QR code
          </label>
        </div>
      </Card>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Preview</h3>
        <p className="text-sm text-tnr-cream/60 mb-4">
          A4 landscape at 40% scale, using a sample member.
        </p>
        <div className="overflow-auto rounded-xl bg-white/5 p-4">
          <div style={{ width: 297 * 0.4 + 'mm', height: 210 * 0.4 + 'mm' }}>
            <div style={{
              width: '297mm', height: '210mm', padding: '18mm', background: '#fff', color: '#111',
              transform: 'scale(0.4)', transformOrigin: 'top left', position: 'relative',
              fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif',
            }}>
              {f.show_border !== false && <>
                <div style={{ position: 'absolute', inset: '8mm', border: `2px solid ${GOLD}` }} />
                <div style={{ position: 'absolute', inset: '10mm', border: '1px solid #0B6B4F44' }} />
              </>}
              <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <img src={f.logo_url || '/tnr-logo.png'} alt=""
                  onError={(e) => { e.currentTarget.src = '/tnr-logo.png'; }}
                  style={{ width: '22mm', height: '22mm', objectFit: 'contain' }} />
                <div style={{ fontSize: '10pt', fontWeight: 900, letterSpacing: '0.2em', marginTop: 8, color: GREEN }}>
                  {f.org_line1}
                </div>
                <div style={{ fontSize: '8pt', letterSpacing: '0.1em', color: '#9ca3af' }}>{f.org_line2}</div>

                <h1 style={{ fontSize: '30pt', fontWeight: 900, marginTop: 24, color: GREEN }}>{f.cert_title}</h1>
                <div style={{ width: '60mm', height: 2, marginTop: 8, background: GOLD }} />

                <p style={{ fontSize: '11pt', color: '#6b7280', marginTop: 24 }}>{f.intro_line}</p>
                <h2 style={{ fontSize: '24pt', fontWeight: 900, marginTop: 4, color: '#0B6B4F' }}>{SAMPLE.full_name}</h2>
                <p style={{ fontSize: '11pt', color: '#4b5563', marginTop: 12, maxWidth: '180mm', lineHeight: 1.6 }}>
                  {fillCertificate(f.body_text, SAMPLE)}
                </p>

                <div style={{ marginTop: 'auto', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'left' }}>
                    {f.show_qr !== false && (
                      <>
                        <div style={{ width: 80, height: 80, background: '#eee', display: 'grid', placeItems: 'center', fontSize: 9, color: '#999' }}>QR</div>
                        <div style={{ fontSize: '7pt', color: '#9ca3af', marginTop: 4 }}>{f.scan_label}</div>
                      </>
                    )}
                    <div style={{ fontSize: '7pt', fontFamily: 'monospace', color: '#6b7280' }}>TNR-CERT-0001</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '9pt', color: '#6b7280' }}>
                    <div>{f.issued_label}</div>
                    <div style={{ fontWeight: 700, color: GREEN }}>
                      {new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {f.signature_url && (
                      <img src={f.signature_url} alt=""
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{ height: '14mm', maxWidth: '46mm', objectFit: 'contain', display: 'block', margin: '0 auto 1mm' }} />
                    )}
                    <div style={{ width: '50mm', borderBottom: `1px solid ${GOLD}` }} />
                    <div style={{ fontSize: '8pt', marginTop: 4, fontWeight: 600, color: GREEN }}>{f.signatory_title}</div>
                    <div style={{ fontSize: '7.5pt', color: '#6b7280' }}>{f.signatory_org}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-tnr-gold text-tnr-green disabled:opacity-40">
          {busy ? 'Saving…' : 'Save template'}
        </button>
        <button type="button" onClick={() => setF({ ...CERT_DEFAULTS })}
          className="text-sm text-tnr-cream/60 hover:text-tnr-cream hover:underline">
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
