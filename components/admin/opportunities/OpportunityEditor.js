'use client';
import { useState } from 'react';
import { aPost } from '../adminApi';
import { Card } from '../ui';
import { CATEGORIES, APPLICATION_TYPES } from '@/lib/opportunities';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';

/* Field wrapper. MUST stay at module scope.
 *
 * Declared inside the component it would be a new function on every render,
 * so React would unmount and remount each input — losing the text cursor after
 * every single keystroke. That exact bug shipped in the news editor and the
 * public contact forms before it was found. */
function F({ label, err, hint, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-tnr-cream/50 mb-1.5">{label}</label>
      {children}
      {hint && !err && <p className="mt-1 text-[11px] text-tnr-cream/40">{hint}</p>}
      {err && <p className="mt-1 text-[11px] font-semibold text-red-300">{err}</p>}
    </div>
  );
}

/* Create / edit an opportunity.
 *
 * Split into two clearly labelled halves, because the split is the whole
 * design of this module: everything above the divider is published to the
 * world, everything below it is shown only to signed-in members. An admin
 * pasting eligibility criteria needs to know which side of that line they are
 * typing on, and a heading is the cheapest way to tell them.
 */
export default function OpportunityEditor({ value, onCancel, onSaved, toast }) {
  const [f, setF] = useState(value);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  function pickCover(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast?.('Cover image must be under 4 MB.', 'err');
    const fr = new FileReader();
    fr.onload = () => setF(p => ({ ...p, cover_data: String(fr.result), cover_url: '' }));
    fr.readAsDataURL(file);
  }

  async function save(action) {
    setBusy(true);
    const r = await aPost('/api/admin/opportunities', { ...f, action });
    setBusy(false);
    if (!r.ok) {
      setErrs(r.errors || {});
      return toast?.(r.message || 'Could not save.', 'err');
    }
    toast?.(action === 'publish' ? 'Published to the website.' : 'Saved.', 'ok');
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-tnr-cream">
          {f.id ? 'Edit opportunity' : 'New opportunity'}
        </h2>
        <button onClick={onCancel} className="text-sm text-tnr-cream/60 hover:underline">
          ← Back to all opportunities
        </button>
      </div>

      {/* ── PUBLIC ── */}
      <Card>
        <div className="mb-4 pb-3 border-b border-tnr-line">
          <h3 className="font-bold text-tnr-goldLight">Public information</h3>
          <p className="text-[11px] text-tnr-cream/40 mt-0.5">
            Visible to everyone on the website. Keep it promotional — the detail belongs below.
          </p>
        </div>

        <div className="space-y-4">
          <F label="Opportunity title" err={errs.title}>
            <input value={f.title} onChange={e => set('title', e.target.value)} className={input}
              placeholder="e.g. Quaid-e-Azam Fellowship Program 2026" />
          </F>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Category">
              <select value={f.category} onChange={e => set('category', e.target.value)} className={input}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Organization / Provider">
              <input value={f.organization || ''} onChange={e => set('organization', e.target.value)}
                className={input} placeholder="e.g. Tehreek-e-Nojawanan Roundu" />
            </F>
          </div>

          {f.category === 'Other' && (
            <F label="Name the category" err={errs.category_other}>
              <input value={f.category_other || ''} onChange={e => set('category_other', e.target.value)}
                className={input} placeholder="e.g. Exchange Programme" />
            </F>
          )}

          <F label="Short public description" err={errs.short_description}
            hint={`${(f.short_description || '').length}/300 — one or two lines, shown on cards`}>
            <textarea value={f.short_description || ''} rows={2} maxLength={300}
              onChange={e => set('short_description', e.target.value)} className={input} />
          </F>

          <F label="Cover image" hint="JPG, PNG or WEBP, under 4 MB. Landscape works best.">
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => pickCover(e.target.files?.[0])}
              className="text-sm text-tnr-cream/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg
                file:border-0 file:bg-tnr-gold file:text-tnr-black file:font-semibold file:text-xs" />
            {(f.cover_data || f.cover_url) && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.cover_data || f.cover_url} alt=""
                  className="w-40 aspect-[16/9] object-cover rounded-lg border border-white/10" />
                <button onClick={() => setF(p => ({ ...p, cover_data: '', cover_url: '' }))}
                  className="text-xs text-red-300 hover:underline">Remove</button>
              </div>
            )}
          </F>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Application deadline"
              hint="A date-only deadline stays open until the end of that day.">
              <input type="date" value={(f.deadline || '').slice(0, 10)}
                onChange={e => set('deadline', e.target.value)} className={input} />
            </F>
            <label className="flex items-end gap-2.5 pb-2 cursor-pointer">
              <input type="checkbox" checked={!!f.pinned} className="w-4 h-4"
                onChange={e => set('pinned', e.target.checked)} />
              <span className="text-sm text-tnr-cream/80">Pin to the top of the board</span>
            </label>
          </div>
        </div>
      </Card>

      {/* ── MEMBER-ONLY ── */}
      <Card>
        <div className="mb-4 pb-3 border-b border-tnr-line">
          <h3 className="font-bold text-tnr-goldLight">Member-only information</h3>
          <p className="text-[11px] text-tnr-cream/40 mt-0.5">
            Shown only to signed-in TNR members. Never sent to the public website —
            leave any field blank and its section simply will not appear.
          </p>
        </div>

        <div className="space-y-4">
          {[
            ['full_description', 'Full description', 8],
            ['eligibility', 'Eligibility', 4],
            ['benefits', 'Benefits', 4],
            ['duration', 'Programme duration', 2],
            ['location', 'Location / Online', 2],
            ['important_dates', 'Important dates', 3],
            ['required_documents', 'Required documents', 3],
            ['instructions', 'Application instructions', 4],
            ['terms', 'Terms & conditions', 3],
            ['additional_info', 'Additional information', 3],
          ].map(([key, label, rows]) => (
            <F key={key} label={label}>
              <textarea value={f[key] || ''} rows={rows}
                onChange={e => set(key, e.target.value)} className={input + ' leading-relaxed'} />
            </F>
          ))}
        </div>
      </Card>

      {/* ── APPLICATION ── */}
      <Card>
        <div className="mb-4 pb-3 border-b border-tnr-line">
          <h3 className="font-bold text-tnr-goldLight">How members apply</h3>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              ['none', 'No application', 'Information only'],
              ['internal', 'TNR application', 'Members apply in the portal'],
              ['external', 'External website', 'Members are sent to the provider'],
            ].map(([k, label, sub]) => (
              <button key={k} type="button" onClick={() => set('application_type', k)}
                className={`text-left rounded-xl border px-3.5 py-3 transition ${f.application_type === k
                  ? 'border-tnr-gold/50 bg-tnr-gold/10' : 'border-white/10 hover:bg-white/5'}`}>
                <span className="block text-sm font-semibold text-tnr-cream">{label}</span>
                <span className="block text-[11px] text-tnr-cream/40">{sub}</span>
              </button>
            ))}
          </div>

          {f.application_type === 'external' && (
            <F label="Official application URL" err={errs.apply_url}>
              <input value={f.apply_url || ''} onChange={e => set('apply_url', e.target.value)}
                className={input} placeholder="https://…" />
            </F>
          )}

          {f.application_type === 'internal' && (
            <p className="text-[11.5px] text-tnr-cream/50 rounded-xl border border-white/10 px-4 py-3 leading-relaxed">
              Members will see their TNR profile filled in automatically, answer five
              short questions, accept the declaration and submit. One application per
              member is enforced by the database.
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => save('save')} disabled={busy} className="btn-ghost !py-2 !px-4 text-sm">
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        <button onClick={() => save('publish')} disabled={busy}
          className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
          {f.status === 'published' ? 'Save & keep published' : 'Publish to website'}
        </button>
        <button onClick={onCancel} className="text-sm text-tnr-cream/60 hover:underline ml-auto">Cancel</button>
      </div>
    </div>
  );
}
