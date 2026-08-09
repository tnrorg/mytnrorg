'use client';
import { useEffect, useState, useRef } from 'react';
import MemberShell from '@/components/member/MemberShell';
import CvPreview from '@/components/member/CvPreview';
import { printSheet } from '@/components/member/printSheet';
import { mGet, mPatch, mPost } from '@/components/member/memberApi';
import { CV_TEMPLATES, CV_SECTIONS } from '@/lib/membership/cv';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const base = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#0B6B4F]';

/** How many entries a section actually holds. Text sections count as 0 or 1. */
function countOf(content, key) {
  const v = content?.[key];
  if (Array.isArray(v)) return v.length;
  return String(v || '').trim() ? 1 : 0;
}

export default function CvEditor({ params }) {
  const [cv, setCv] = useState(null);
  const [saved, setSaved] = useState('');
  const timer = useRef(null);

  useEffect(() => { mGet('/api/member/cv/' + params.id).then(r => r.ok && setCv(r.cv)); }, [params.id]);

  // Auto-save drafts 1s after typing stops.
  const queueSave = (next) => {
    setCv(next); setSaved('Saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await mPatch('/api/member/cv/' + params.id, {
        title: next.title, template: next.template, content: next.content,
        visible_sections: next.visible_sections, show_photo: next.show_photo,
      });
      setSaved(r.ok ? 'Saved' : 'Save failed');
      setTimeout(() => setSaved(''), 1500);
    }, 1000);
  };
  const setField = (k, v) => queueSave({ ...cv, content: { ...cv.content, [k]: v } });
  const toggleSection = (k) => {
    const cur = cv.visible_sections || [];
    queueSave({ ...cv, visible_sections: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k] });
  };

  const [syncing, setSyncing] = useState(false);

  /** Pull the current profile back in — see the resync route for why. */
  async function resync() {
    setSyncing(true);
    const r = await mPost('/api/member/cv/' + params.id + '/resync');
    setSyncing(false);
    if (!r.ok) { setSaved(r.message || 'Refresh failed'); setTimeout(() => setSaved(''), 2500); return; }
    setCv(r.cv);
    // Name what arrived, so "nothing changed" is distinguishable from "it
    // worked but your profile really is empty".
    const total = Object.values(r.counts || {}).reduce((a, b) => a + b, 0);
    setSaved(total ? `Updated — ${total} entries` : 'Your profile has no entries yet');
    setTimeout(() => setSaved(''), 3000);
  }

  async function duplicate() {
    const r = await mPost('/api/member/cv/' + params.id);
    if (r.ok) window.location.href = '/member/cv-builder/' + r.cv.id;
  }
  async function remove() {
    if (!confirm('Delete this CV? This cannot be undone.')) return;
    await fetch('/api/member/cv/' + params.id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('tnr_member_token') },
    });
    window.location.href = '/member/cv-builder';
  }

  if (!cv) return <MemberShell active="/member/cv-builder"><p className="text-gray-400">Loading…</p></MemberShell>;
  const c = cv.content || {};

  return (
    <MemberShell active="/member/cv-builder">
      <div className="flex items-center gap-3 flex-wrap">
        <a href="/member/cv-builder" className="text-sm" style={{ color: C.green }}>← All CVs</a>
        <input value={cv.title} onChange={e => queueSave({ ...cv, title: e.target.value })}
          className="flex-1 min-w-[180px] text-xl font-black bg-transparent outline-none" style={{ ...mont, color: C.deep }} />
        <span className="text-xs text-gray-400 w-16">{saved}</span>
        <button onClick={() => printSheet('cv-sheet', cv.title)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
          Download / Print PDF
        </button>
        <button onClick={duplicate} className="px-3 py-2 rounded-xl text-sm border border-gray-200">Duplicate</button>
        <button onClick={remove} className="px-3 py-2 rounded-xl text-sm text-red-500 border border-red-200">Delete</button>
      </div>

      <div className="mt-5 grid lg:grid-cols-[380px,1fr] gap-5 items-start">
        {/* Editor */}
        <div className="space-y-4">
          <Panel title="Template">
            <select value={cv.template} onChange={e => queueSave({ ...cv, template: e.target.value })} className={base}>
              {CV_TEMPLATES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <label className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              <input type="checkbox" checked={cv.show_photo} onChange={e => queueSave({ ...cv, show_photo: e.target.checked })} />
              Show profile photo
            </label>
          </Panel>

          <Panel title="Sections">
            <div className="space-y-1.5">
              {CV_SECTIONS.map(([k, l]) => {
                const count = countOf(cv.content, k);
                const ticked = (cv.visible_sections || []).includes(k);
                return (
                  <label key={k} className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={ticked} onChange={() => toggleSection(k)} />
                    <span className="flex-1">{l}</span>
                    {/* A ticked section with nothing in it prints as nothing.
                        Saying so here is the difference between "the builder is
                        broken" and "there is no data yet". */}
                    {ticked && count === 0 && (
                      <span className="text-[10px] font-semibold text-amber-600">empty</span>
                    )}
                  </label>
                );
              })}
            </div>

            <button type="button" onClick={resync} disabled={syncing}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold
                text-[#0B6B4F] hover:bg-gray-50 disabled:opacity-40">
              {syncing ? 'Refreshing…' : '↻ Refresh from my profile'}
            </button>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
              This CV holds a copy of your profile from when it was created.
              Added a job or certificate since then? Refresh to pull it in.
            </p>
          </Panel>

          <Panel title="Header">
            {[['full_name', 'Full Name'], ['headline', 'Professional Headline'], ['email', 'Email'],
              ['phone', 'Phone'], ['location', 'Location'], ['linkedin', 'LinkedIn'],
              ['github', 'GitHub'], ['portfolio', 'Portfolio']].map(([k, l]) => (
              <div key={k} className="mb-2">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">{l}</label>
                <input value={c[k] || ''} onChange={e => setField(k, e.target.value)} className={base} />
              </div>
            ))}
          </Panel>

          <Panel title="Professional Summary">
            <textarea rows={5} value={c.summary || ''} onChange={e => setField('summary', e.target.value)} className={base} />
          </Panel>

          <Panel title="Awards & Achievements">
            <textarea rows={3} value={c.awards || ''} onChange={e => setField('awards', e.target.value)} className={base} />
          </Panel>

          <p className="text-xs text-gray-400 px-1">
            Education, experience, skills and other entries come from your profile.
            Update them in <a href="/member/profile" className="font-semibold" style={{ color: C.green }}>My Profile</a>,
            then create a new CV to pull the latest details.
          </p>
        </div>

        {/* Live preview */}
        <div className="overflow-auto">
          <div className="origin-top-left scale-[0.62] sm:scale-75 lg:scale-[0.85] xl:scale-100">
            <CvPreview cv={cv} />
          </div>
        </div>
      </div>
    </MemberShell>
  );
}

const Panel = ({ title, children }) => (
  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
    <h3 style={{ ...mont, color: C.deep }} className="text-xs font-black uppercase tracking-wide mb-3">{title}</h3>
    {children}
  </div>
);
