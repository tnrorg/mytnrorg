'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost, mDel } from '@/components/member/memberApi';
import {
  KINDS, kindIcon, kindLabel, orgLabel, STATUS_LABEL, STATUS_TONE,
  canMemberEdit, validateStory, wordCount, achievedLabel,
  TITLE_MAX, ORG_MAX, DESC_MAX, DESC_MIN_WORDS,
} from '@/lib/successStories';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };
const input =
  'w-full rounded-xl border px-3 py-2 text-[14px] outline-none focus:ring-2 border-gray-200';

const BLANK = {
  kind: 'degree', title: '', organisation: '', description: '',
  achieved_on: '', image_url: '',
};

/* My Success Stories.
 *
 * A member records something they achieved — a degree, a job, a certificate —
 * and once an office bearer approves it, it appears on the public TNR site as
 * a card with their name and photograph.
 *
 * The page is explicit that this is PUBLIC before anything is typed. Somebody
 * sharing good news should know exactly where it is going, and finding out
 * afterwards is the kind of surprise that makes people stop using a feature.
 */
export default function MySuccessStories() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState(null);           // null = form closed
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    mGet('/api/member/success-stories')
      .then(r => setD(r || null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const stories = d?.stories || [];
  const atCap = (d?.pending || 0) >= (d?.max_pending || 3);
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  async function save() {
    const e = validateStory(f);
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const r = await mPost('/api/member/success-stories', f);
    setBusy(false);

    if (!r?.ok) {
      if (r?.errors) setErrors(r.errors);
      return setNote({ tone: 'err', text: r?.message || 'Could not submit.' });
    }
    setNote({ tone: 'ok', text: r.message });
    setF(null);
    load();
  }

  async function withdraw(s) {
    if (!confirm('Withdraw this story? It will be removed from the review queue.')) return;
    const r = await mDel(`/api/member/success-stories?id=${s.id}`);
    if (!r?.ok) return setNote({ tone: 'err', text: r?.message || 'Could not withdraw.' });
    setNote({ tone: 'ok', text: r.message });
    load();
  }

  return (
    <MemberShell title="Success Stories">
      <div className="mx-auto max-w-3xl px-4 py-6">

        <header className="mb-5">
          <h1 className="text-[22px] font-black" style={{ color: C.deep }}>
            My Success Stories
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">
            Finished a degree, started a job, earned a certificate, won something?
            Share it. Once an office bearer approves it, it appears on the{' '}
            <b style={{ color: '#15231D' }}>public TNR website</b> as a card with
            your name and profile photograph.
          </p>
        </header>

        {note && (
          <div className="mb-4 rounded-xl px-4 py-3 text-[13.5px]"
            style={note.tone === 'ok'
              ? { background: 'rgba(16,140,90,.10)', color: '#0A5B3A' }
              : { background: 'rgba(170,60,60,.10)', color: '#8A2F2F' }}>
            {note.text}
          </div>
        )}

        {!f && (
          <button type="button" onClick={() => { setF({ ...BLANK }); setErrors({}); }}
            disabled={atCap}
            className="mb-5 w-full rounded-xl px-4 py-3 text-[15px] font-bold text-white disabled:opacity-50"
            style={{ background: C.green }}>
            + Share an achievement
          </button>
        )}
        {atCap && !f && (
          <p className="-mt-3 mb-5 text-center text-[12.5px] text-gray-500">
            You have {d.pending} stories waiting for review. You can add another
            once those have been looked at.
          </p>
        )}

        {/* ── The form ── */}
        {f && (
          <section className="mb-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: '#E7EAE8' }}>
            <h2 className="mb-3 text-[15px] font-bold" style={{ color: C.deep }}>
              {f.id ? 'Edit your story' : 'Share an achievement'}
            </h2>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-gray-500">What kind of achievement? *</span>
              <select value={f.kind} onChange={e => set('kind', e.target.value)} className={input}>
                {KINDS.map(k => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}
              </select>
              <span className="mt-1 block text-[11.5px] text-gray-400">
                {KINDS.find(k => k.key === f.kind)?.hint}
              </span>
              <Err e={errors.kind} />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-gray-500">Title *</span>
              <input value={f.title} maxLength={TITLE_MAX}
                onChange={e => set('title', e.target.value)} className={input}
                placeholder="MSc Computer Science" />
              <Err e={errors.title} />
            </label>

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                {/* The label follows the kind — "University" for a degree,
                    "Employer" for a job — while the column stays one column. */}
                <span className="mb-1 block text-xs text-gray-500">{orgLabel(f.kind)}</span>
                <input value={f.organisation} maxLength={ORG_MAX}
                  onChange={e => set('organisation', e.target.value)} className={input}
                  placeholder="University of Baltistan, Skardu" />
                <Err e={errors.organisation} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-gray-500">When (month)</span>
                <input type="month" value={(f.achieved_on || '').slice(0, 7)}
                  onChange={e => set('achieved_on', e.target.value)} className={input} />
                <Err e={errors.achieved_on} />
              </label>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-gray-500">Tell us about it *</span>
              <textarea rows={5} value={f.description} maxLength={DESC_MAX}
                onChange={e => set('description', e.target.value)} className={input}
                placeholder="A few lines in your own words — what it was, and what it means to you." />
              <span className="mt-1 block text-[11.5px] text-gray-400">
                {wordCount(f.description)} words
                {wordCount(f.description) < DESC_MIN_WORDS && ` — at least ${DESC_MIN_WORDS} needed`}
              </span>
              <Err e={errors.description} />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-xs text-gray-500">
                Photo link <span className="text-gray-400">(optional)</span>
              </span>
              <input value={f.image_url} onChange={e => set('image_url', e.target.value)}
                className={input} placeholder="https://… a photo of the certificate or the day" />
              <span className="mt-1 block text-[11.5px] text-gray-400">
                Optional. Your profile photograph is used on the card either way.
              </span>
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setF(null)} disabled={busy}
                className="flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-bold disabled:opacity-50"
                style={{ borderColor: '#DDE3DF', color: '#3A4842' }}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={busy}
                className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
                style={{ background: C.green }}>
                {busy ? 'Sending…' : 'Send for review'}
              </button>
            </div>
          </section>
        )}

        {/* ── Their own stories ── */}
        {loading && <p className="text-[14px] text-gray-500">Loading…</p>}

        {!loading && !!d && !d.ok && (
          <p className="rounded-xl px-4 py-3 text-[13.5px]"
            style={{ background: 'rgba(170,60,60,.09)', color: '#8A2F2F' }}>
            {d.message}{d.detail ? ` ${d.detail}` : ''}
          </p>
        )}

        {!loading && d?.ok && !stories.length && !f && (
          <p className="rounded-xl px-4 py-3 text-[13.5px]" style={{ background: '#F6F8F7', color: '#5A6660' }}>
            You have not shared anything yet.
          </p>
        )}

        {stories.map(s => {
          const tone = STATUS_TONE[s.status] || STATUS_TONE.pending;
          return (
            <article key={s.id} className="mb-3 rounded-2xl border bg-white p-4" style={{ borderColor: '#E7EAE8' }}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[15px]">{kindIcon(s.kind)}</span>
                <b className="text-[15px]" style={{ color: '#15231D' }}>{s.title}</b>
                <span className="ml-auto rounded-lg px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>

              <p className="text-[12.5px] text-gray-500">
                {kindLabel(s.kind)}
                {s.organisation ? ` · ${s.organisation}` : ''}
                {s.achieved_on ? ` · ${achievedLabel(s.achieved_on)}` : ''}
              </p>

              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: '#3A4842' }}>
                {s.description}
              </p>

              {/* The committee's note, shown to the person it is for. A story
                  sent back with no reason is a dead end. */}
              {s.review_note && (
                <p className="mt-3 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
                  style={{ background: 'rgba(200,154,43,.12)', color: '#7A5C10' }}>
                  <b>Note from the committee:</b> {s.review_note}
                </p>
              )}

              {canMemberEdit(s.status) && (
                <div className="mt-3 flex gap-2">
                  <button type="button"
                    onClick={() => { setF({ ...s, achieved_on: (s.achieved_on || '').slice(0, 7) }); setErrors({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="rounded-lg border px-3 py-1.5 text-[12.5px] font-bold"
                    style={{ borderColor: '#DDE3DF', color: '#3A4842' }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => withdraw(s)}
                    className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold"
                    style={{ color: '#8A2F2F' }}>
                    Withdraw
                  </button>
                </div>
              )}

              {s.status === 'published' && (
                <a href="/media/success-stories"
                  className="mt-3 inline-block text-[12.5px] font-bold underline" style={{ color: C.green }}>
                  See it on the website →
                </a>
              )}
            </article>
          );
        })}
      </div>
    </MemberShell>
  );
}

function Err({ e }) {
  if (!e) return null;
  return <span className="mt-1 block text-[12.5px] font-medium" style={{ color: '#B4271F' }}>{e}</span>;
}
