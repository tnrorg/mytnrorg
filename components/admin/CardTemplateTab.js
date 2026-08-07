'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';
import { Card, Field } from './ui';
import { CARD_DEFAULTS } from '@/lib/cardDefaults';

const asText = (v) => Array.isArray(v) ? v.join('\n') : (v || '');

export default function CardTemplateTab({ toast }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/card-settings');
    if (!r?.ok) { setErr(r?.message || 'Could not load the card template.'); setF({ ...CARD_DEFAULTS }); return; }
    setF({ ...CARD_DEFAULTS, ...r.settings, benefits: asText(r.settings?.benefits ?? CARD_DEFAULTS.benefits) });
  }
  useEffect(() => { load(); }, []);

  function pickSignature(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Signature must be under 2 MB', 'err');
    const rd = new FileReader();
    rd.onload = () => setF(s => ({ ...s, signature_data: rd.result, signature_url: rd.result }));
    rd.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    const r = await aPatch('/api/admin/card-settings', f);
    setSaving(false);
    if (!r?.ok) return toast(r?.message || 'Save failed', 'err');
    toast('Card template saved'); load();
  }

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  if (!f) return <Card><div className="text-sm text-tnr-cream/60">Loading card template…</div></Card>;

  return <div className="space-y-4 max-w-3xl">
    <p className="text-sm text-tnr-cream/60">
      Wording shown on every member’s digital membership card. Member details
      (name, photo, ID, village) come from their own record and are not set here.
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    <Card>
      <h3 className="font-black text-tnr-cream mb-3">Card Front</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Organisation — line 1"><input className="input" value={f.org_line1 || ''} onChange={set('org_line1')} /></Field>
        <Field label="Organisation — line 2"><input className="input" value={f.org_line2 || ''} onChange={set('org_line2')} /></Field>
        <Field label="Card Label"><input className="input" value={f.card_label || ''} onChange={set('card_label')} /></Field>
        <Field label="Footer Tagline"><input className="input" value={f.footer_tagline || ''} onChange={set('footer_tagline')} /></Field>
      </div>
    </Card>

    <Card>
      <h3 className="font-black text-tnr-cream mb-3">Signature Block</h3>
      <div className="flex items-center gap-4 mb-3">
        {f.signature_url
          ? <img src={f.signature_url} alt="" className="h-14 bg-white rounded-lg px-3 object-contain" />
          : <div className="h-14 w-32 rounded-lg bg-white/10 grid place-items-center text-xs text-tnr-cream/50">No signature</div>}
        <div>
          <input type="file" accept="image/*" onChange={pickSignature} className="text-xs text-tnr-cream/70" />
          <p className="text-[11px] text-tnr-cream/40 mt-1">PNG or JPG on a white background. Max 2 MB.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Signatory Title"><input className="input" value={f.signatory_title || ''} onChange={set('signatory_title')} /></Field>
        <Field label="Caption Under the Line"><input className="input" value={f.signature_note || ''} onChange={set('signature_note')} /></Field>
      </div>
    </Card>

    <Card>
      <h3 className="font-black text-tnr-cream mb-3">Card Back</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <Field label="Scan Button Label"><input className="input" value={f.scan_label || ''} onChange={set('scan_label')} /></Field>
        <Field label="Verified Badge Label"><input className="input" value={f.verify_label || ''} onChange={set('verify_label')} /></Field>
        <Field label="About Heading"><input className="input" value={f.about_heading || ''} onChange={set('about_heading')} /></Field>
        <Field label="Benefits Heading"><input className="input" value={f.benefits_heading || ''} onChange={set('benefits_heading')} /></Field>
      </div>
      <Field label="About Text">
        <textarea className="input min-h-[80px]" value={f.about_text || ''} onChange={set('about_text')} />
      </Field>
      <Field label="Member Benefits — one per line">
        <textarea className="input min-h-[120px]" value={f.benefits || ''} onChange={set('benefits')} />
      </Field>
    </Card>

    <Card>
      <h3 className="font-black text-tnr-cream mb-3">Contact Strip</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Website"><input className="input" value={f.website || ''} onChange={set('website')} /></Field>
        <Field label="Email"><input className="input" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="input" value={f.phone || ''} onChange={set('phone')} /></Field>
      </div>
    </Card>

    <div className="flex gap-2">
      <button className="btn-green" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Card Template'}</button>
      <button className="btn-ghost" onClick={load} disabled={saving}>Reset</button>
    </div>
  </div>;
}
