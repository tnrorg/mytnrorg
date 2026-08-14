'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Field } from './ui';
import { SLIDE_LIMITS, blankSlide, clampField } from '@/lib/heroSlides';
import { resizeImage, kb } from '@/lib/imageResize';

/* Hero carousel editor.
 *
 * Every slide's image, wording, buttons, overlay and font sizes are set here.
 * Phone and desktop font sizes are separate fields on purpose: one number
 * scaled for both always ends up too big on a phone or too small on a laptop.
 *
 * With no slides the home page falls back to the built-in hero, so it is safe
 * to leave this empty or to switch every slide off.
 */
export default function HeroTab({ toast }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  // Held in state rather than built inline in JSX: a fresh blankSlide() on every
  // render would be a new object each time, and the editor's reset effect would
  // wipe what the admin was typing.
  const [draft, setDraft] = useState(null);

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/hero');
    if (!r?.ok) {
      setErr(`${r?.message || 'Could not load the slides.'}${r?.hint ? ` — ${r.hint}` : ''}`);
      setRows([]); return;
    }
    setRows(r.slides);
  }
  useEffect(() => { load(); }, []);

  if (!rows) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  const liveCount = rows.filter(r => r.active).length;

  return <div className="space-y-4 max-w-3xl">
    <p className="text-sm text-tnr-cream/60">
      Slides shown at the top of the home page. They rotate every 6.5 seconds and
      pause when someone hovers or uses the keyboard.
      {liveCount === 0 && ' With none switched on, the home page shows its built-in hero instead.'}
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}</div></Card>}

    {rows.map(row => (
      <SlideEditor key={row.id} row={row} toast={toast} onDone={load} />
    ))}

    {draft
      ? <SlideEditor row={draft} isNew toast={toast}
          onDone={() => { setDraft(null); load(); }} onCancel={() => setDraft(null)} />
      : <button className="btn" onClick={() => setDraft(blankSlide())}>+ Add slide</button>}
  </div>;
}

function SlideEditor({ row, isNew, toast, onDone, onCancel }) {
  const [f, setF] = useState(row);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(row); }, [row]);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const setNum = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  // Photos are resized in the browser before they are sent. A phone photo is
  // several MB, base64 adds a third, and the server rejects bodies above about
  // 4.5 MB — which is what made a second, larger slide fail to save while the
  // first went through.
  async function pickImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { dataUrl, width, height, bytes } = await resizeImage(file, { maxWidth: 1920, maxHeight: 1280 });
      setF(s => ({ ...s, image_data: dataUrl, image_url: dataUrl }));
      toast(`Image ready — ${width}×${height}, ${kb(bytes)}`);
    } catch (ex) {
      toast(ex.message || 'Could not read that image', 'err');
    }
  }

  async function save(overrides = {}) {
    const body = { ...f, ...overrides };
    // Clamp before sending, so the form and the database CHECK constraints
    // cannot disagree and produce an unexplained save failure.
    for (const k of Object.keys(SLIDE_LIMITS)) body[k] = clampField(k, body[k]);
    if (!String(body.title || '').trim() && !body.image_data && !body.image_url) {
      return toast('Give the slide a headline or a background image.', 'err');
    }
    setBusy(true);
    const r = isNew
      ? await aPost('/api/admin/hero', body)
      : await aPatch(`/api/admin/hero/${f.id}`, body);
    setBusy(false);
    if (!r?.ok) return toast(`${r?.message || 'Save failed'}${r?.hint ? ` — ${r.hint}` : ''}`, 'err');
    toast(r.message || 'Saved'); onDone();
  }

  async function remove() {
    if (!confirm('Delete this slide? This cannot be undone.')) return;
    setBusy(true);
    const r = await aDel(`/api/admin/hero/${f.id}`);
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Delete failed', 'err');
    toast('Slide deleted'); onDone();
  }

  const overlay = clampField('overlay', f.overlay);

  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 className="font-black text-tnr-cream">
        {isNew ? 'New slide' : (f.title || '(no headline)')}
      </h3>
      {!isNew && (
        <span className={`text-[11px] px-2 py-1 rounded-full ${f.active
          ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-tnr-cream/50'}`}>
          {f.active ? 'Live' : 'Hidden'}
        </span>
      )}
    </div>

    {/* ── Background image ── */}
    <span className="label">Background image</span>
    <div className="flex items-start gap-4 mt-1 mb-4">
      {f.image_url
        ? <img src={f.image_url} alt="" className="h-24 w-40 rounded-lg object-cover" />
        : <div className="h-24 w-40 rounded-lg bg-white/10 grid place-items-center text-[11px] text-tnr-cream/50">No image</div>}
      <div>
        <input type="file" accept="image/*" onChange={pickImage} className="text-xs text-tnr-cream/70" />
        <p className="text-[11px] text-tnr-cream/40 mt-1">
          Wide landscape photo. Any size — it is resized to 1920px wide
          automatically, so large phone photos are fine.
        </p>
        {f.image_url && (
          <button className="btn-ghost !py-1 !px-2 text-xs mt-2"
            onClick={() => setF(s => ({ ...s, image_url: null, image_data: null }))}>
            Remove image
          </button>
        )}
      </div>
    </div>

    {/* ── Words ── */}
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Small label above the headline">
        <input className="input" value={f.eyebrow || ''} onChange={set('eyebrow')}
          placeholder="Roundu · Gilgit-Baltistan" />
      </Field>
      <Field label="Text alignment">
        <select className="input" value={f.align} onChange={set('align')}>
          <option value="left">Left</option>
          <option value="center">Centre</option>
        </select>
      </Field>
    </div>
    <Field label="Headline">
      <input className="input" value={f.title || ''} onChange={set('title')} />
    </Field>
    <Field label="Supporting text">
      <textarea className="input min-h-[90px]" value={f.subtitle || ''} onChange={set('subtitle')} />
    </Field>

    {/* ── Buttons ── */}
    <div className="grid sm:grid-cols-2 gap-3">
      {/* The two buttons are shown as ONE button that opens a menu. This is the
          text on that button; the two below are the choices inside it. */}
      <Field label="Menu button — text (optional)">
        <input className="input" value={f.cta_button_label || ''} onChange={set('cta_button_label')}
          placeholder="Join/Login TNR" />
        <span className="block mt-1 text-[11px] text-tnr-cream/40">
          Leave empty to reuse Button 1’s text.
        </span>
      </Field>
      <Field label="Button 1 — text"><input className="input" value={f.cta1_label || ''} onChange={set('cta1_label')} placeholder="Join TNR" /></Field>
      <Field label="Button 1 — link"><input className="input" value={f.cta1_href || ''} onChange={set('cta1_href')} placeholder="/membership/apply" /></Field>
      <Field label="Button 2 — text"><input className="input" value={f.cta2_label || ''} onChange={set('cta2_label')} placeholder="Explore Our Work" /></Field>
      <Field label="Button 2 — link"><input className="input" value={f.cta2_href || ''} onChange={set('cta2_href')} placeholder="/about" /></Field>
    </div>
    <p className="-mt-1 mb-3 text-[11px] text-tnr-cream/40">
      Leave a button’s text empty to hide it. Links starting with “/” stay on this site.
    </p>

    {/* ── Font sizes ── */}
    <div className="rounded-xl border border-tnr-line/60 p-3 mb-3">
      <div className="text-xs font-bold text-tnr-goldLight mb-2">Text size</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SizeInput label="Headline — mobile"  field="title_size_mobile"  f={f} onChange={setNum} />
        <SizeInput label="Headline — desktop" field="title_size_desktop" f={f} onChange={setNum} />
        <SizeInput label="Body — mobile"      field="text_size_mobile"   f={f} onChange={setNum} />
        <SizeInput label="Body — desktop"     field="text_size_desktop"  f={f} onChange={setNum} />
      </div>
      <p className="text-[11px] text-tnr-cream/40 mt-2">
        Pixels. Mobile applies below 1024px wide, desktop at and above it.
      </p>
    </div>

    {/* ── Overlay ── */}
    <Field label={`Image darkness — ${overlay}%`}>
      <input type="range" min={SLIDE_LIMITS.overlay.min} max={SLIDE_LIMITS.overlay.max}
        value={overlay} onChange={setNum('overlay')} className="w-full accent-tnr-gold" />
    </Field>
    {overlay < 35 && (
      <p className="-mt-2 mb-3 text-[11px] text-amber-300">
        Below about 35% the white headline can be hard to read over a bright photo.
      </p>
    )}

    <div className="flex flex-wrap items-center gap-2 mt-4">
      <button className="btn" disabled={busy} onClick={() => save()}>
        {busy ? 'Saving…' : (isNew ? 'Add slide' : 'Save')}
      </button>
      {isNew
        ? <button className="btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        : <>
            <button className="btn-ghost" disabled={busy} onClick={() => save({ active: !f.active })}>
              {f.active ? 'Hide from home page' : 'Show on home page'}
            </button>
            <input type="number" className="input !w-24" value={f.sort_order ?? 0}
              onChange={setNum('sort_order')} title="Order — lower shows first" />
            <button className="btn-ghost !text-red-300 ml-auto" disabled={busy} onClick={remove}>Delete</button>
          </>}
    </div>
  </Card>;
}

function SizeInput({ label, field, f, onChange }) {
  const { min, max } = SLIDE_LIMITS[field];
  return (
    <label className="block">
      <span className="label !text-[11px]">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" className="input" min={min} max={max}
          value={f[field] ?? ''} onChange={onChange(field)} />
        <span className="text-[11px] text-tnr-cream/40">px</span>
      </div>
    </label>
  );
}
