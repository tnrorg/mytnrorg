'use client';
import { useEffect, useState } from 'react';
import { PenLine, Send, Trash2, ExternalLink, AlertCircle, CheckCircle2, Eye, Heart } from 'lucide-react';
import MemberShell from '@/components/member/MemberShell';
import Avatar from '@/components/ui/Avatar';
import { mGet, mPost, mDel } from '@/components/member/memberApi';
import { validateOpinion, wordCount, LIMITS, MIN_BODY_WORDS, STATUS_LABEL, STATUS_HELP } from '@/lib/opinions';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', muted: '#647169' };

const TONE = {
  draft:             { bg: '#F1F4F2', fg: '#4B5563' },
  pending:           { bg: '#FEF3C7', fg: '#92400E' },
  published:         { bg: '#DCFCE7', fg: '#166534' },
  changes_requested: { bg: '#FEF3C7', fg: '#92400E' },
  rejected:          { bg: '#FEE2E2', fg: '#991B1B' },
};

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
}) : '');

/* Where a member writes and submits an Opinion.
 *
 * The status of each piece is the important thing on this page — someone who
 * has submitted something wants to know where it stands, and what to do if the
 * committee has asked for changes.
 */
/* How a published piece was received. Only its author ever sees this.
 *
 * Reads and likes sit together because one without the other misleads: fifty
 * reads and no likes says something quite different from five reads and five
 * likes, and either number alone invites the wrong conclusion.
 *
 * Readers are counted, never named. Liking is a choice someone made; reading
 * is not, and a member who quietly opens an article has not volunteered to be
 * listed anywhere.
 */
function Reception({ o }) {
  const [open, setOpen] = useState(false);
  const likes = o.likes || { count: 0, anonymous: 0, people: [] };
  const views = Number(o.views || 0);

  if (!views && !likes.count) {
    return (
      <p className="mt-3 pt-3 border-t border-gray-100 text-[12px] text-gray-400">
        No reads yet. Newly published pieces take a little while to be found.
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <Eye size={13} aria-hidden="true" />
          <b className="text-gray-700">{views.toLocaleString()}</b>
          {views === 1 ? 'read' : 'reads'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <Heart size={13} aria-hidden="true" fill={likes.count ? 'currentColor' : 'none'}
            className={likes.count ? 'text-rose-500' : ''} />
          <b className="text-gray-700">{likes.count.toLocaleString()}</b>
          {likes.count === 1 ? 'like' : 'likes'}
        </span>
        {likes.people.length > 0 && (
          <button onClick={() => setOpen(v => !v)}
            className="font-bold hover:underline" style={{ color: C.green }}>
            {open ? 'Hide' : 'See who liked'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {likes.people.map(p => (
            <a key={p.membership_id || p.full_name}
              href={p.membership_id ? `/members/${p.membership_id}` : undefined}
              className="flex items-center gap-2.5 group">
              <Avatar src={p.photo_url} gender={p.gender} name={p.full_name || 'Member'}
                className="w-7 h-7 shrink-0" />
              <span className="text-[13px] font-semibold text-gray-700 group-hover:underline">
                {p.full_name}
              </span>
            </a>
          ))}
          {likes.anonymous > 0 && (
            <p className="text-[12px] text-gray-400 pt-1">
              and {likes.anonymous} {likes.anonymous === 1 ? 'reader' : 'readers'} who
              {likes.anonymous === 1 ? ' was' : ' were'} not signed in
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MemberOpinionsPage() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);   // the opinion being written
  const [errors, setErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => mGet('/api/member/opinions').then(r => {
    if (r?.ok) { setRows(r.opinions || []); setErr(''); }
    else { setRows([]); setErr(r?.hint || r?.message || 'Could not load your opinions.'); }
  });
  useEffect(() => { load(); }, []);

  const blank = { title: '', summary: '', body: '', cover_url: null };
  const set = (k) => (e) => setEditing(p => ({ ...p, [k]: e.target.value }));

  function pickCover(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setErr('Cover must be a JPG, PNG or WEBP.');
    /* 3 MB, not 4.
     *
     * Base64 inflates a file by about a third, and Vercel rejects a request
     * body over roughly 4.5 MB before any of our code runs — so a 4 MB image
     * became a ~5.4 MB request and was refused by the platform, which the
     * member saw as an unexplained failure to save. */
    if (file.size > 3 * 1024 * 1024) {
      return setErr('Cover image must be smaller than 3 MB. Please resize it and try again.');
    }
    setErr('');
    const fr = new FileReader();
    // `cover_preview` is for the thumbnail only and is never sent. It used to
    // be written to `cover_url` as well, which meant the whole base64 image
    // travelled in the request TWICE and doubled its size for no reason.
    fr.onload = () => setEditing(p => ({ ...p, cover_data: fr.result, cover_preview: fr.result }));
    fr.readAsDataURL(file);
  }

  async function save(action) {
    if (action === 'submit') {
      setTried(true);
      const found = validateOpinion(editing);
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    setBusy(true); setErr('');
    /* Send only the fields the server actually reads.
     *
     * Spreading the whole editing object also shipped `status`, `slug`,
     * `review_note`, timestamps and — worst — the base64 preview, none of
     * which the API uses. On a piece with a cover image that roughly doubled
     * the request for nothing. */
    const r = await mPost('/api/member/opinions', {
      action,
      id: editing.id,
      title: editing.title,
      summary: editing.summary,
      body: editing.body,
      // Only when a NEW file was chosen. `cover_url: null` is the explicit
      // "remove the existing image" signal and must survive.
      ...(editing.cover_data ? { cover_data: editing.cover_data } : {}),
      ...(editing.cover_url === null && !editing.cover_data ? { cover_url: null } : {}),
    });
    setBusy(false);
    if (!r?.ok) {
      if (r?.errors) setErrors(r.errors);
      /* Show the hint, not just the headline.
       *
       * "Could not save." on its own tells someone who has written 700 words
       * nothing about whether to try again, shorten it, or fetch an admin. The
       * server sends a `hint` naming the actual cause — an un-run migration,
       * most often — and hiding it made a fixable problem look like a dead end. */
      setErr([r?.message || 'Could not save.', r?.hint].filter(Boolean).join(' '));
      return;
    }
    setMsg(action === 'submit'
      ? 'Sent to the committee for review.'
      : 'Saved as a draft.');
    setTimeout(() => setMsg(''), 4000);
    setEditing(null); setTried(false); setErrors({});
    load();
  }

  async function remove(o) {
    if (!confirm(`Delete “${o.title || 'Untitled'}”? This cannot be undone.`)) return;
    const r = await mDel('/api/member/opinions?id=' + o.id);
    if (!r?.ok) return setErr(r?.message || 'Could not delete.');
    load();
  }

  const input = 'w-full rounded-xl border border-gray-200 bg-white text-[#15231D] px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B4F]';
  const showErr = (k) => (tried ? errors[k] : '');

  return (
    <MemberShell active="/member/opinions">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: C.deep }}>Opinions</h1>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              Write a piece for the TNR site. The committee reviews it before it is published.
            </p>
          </div>
          {!editing && (
            <button onClick={() => { setEditing({ ...blank }); setTried(false); setErrors({}); }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
              <PenLine size={15} aria-hidden="true" /> Write an opinion
            </button>
          )}
        </div>

        {msg && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={16} aria-hidden="true" />{msg}
          </div>
        )}
        {err && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{err}
          </div>
        )}

        {/* ── Editor ── */}
        {editing && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-8 space-y-4">
            <label className="block">
              <span className="block text-xs font-bold text-gray-600 mb-1.5">Title *</span>
              <input className={input} value={editing.title || ''} onChange={set('title')}
                maxLength={LIMITS.title} placeholder="What is your opinion about?" />
              {showErr('title') && <span className="mt-1 block text-[11px] text-red-600">{showErr('title')}</span>}
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-gray-600 mb-1.5">
                One-line summary *
                <span className="font-normal text-gray-400"> — shown on the listing page</span>
              </span>
              <input className={input} value={editing.summary || ''} onChange={set('summary')}
                maxLength={LIMITS.summary} />
              {showErr('summary') && <span className="mt-1 block text-[11px] text-red-600">{showErr('summary')}</span>}
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-gray-600 mb-1.5">Cover image (optional)</span>
              <div className="flex items-start gap-4">
                {/* The just-chosen file if there is one, otherwise whatever is
                    already saved on the record. */}
                <div className="w-28 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 grid place-items-center">
                  {(editing.cover_preview || editing.cover_url)
                    ? <img src={editing.cover_preview || editing.cover_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[10px] text-gray-400">None</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <input type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={e => pickCover(e.target.files?.[0])}
                    className="block w-full text-xs text-gray-600
                      file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                      file:text-xs file:font-bold file:text-white file:cursor-pointer
                      file:bg-[#0B6B4F]" />
                  {/* Offered whenever there is something to remove — a
                      just-chosen file or an already-saved one. Clearing sets
                      all three, or the thumbnail would keep showing an image
                      the member has just removed. */}
                  {(editing.cover_preview || editing.cover_url) && (
                    <button onClick={() => setEditing(p => ({ ...p, cover_url: null, cover_data: null, cover_preview: null }))}
                      className="mt-2 text-[11px] text-red-500 hover:underline">Remove image</button>
                  )}
                </div>
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-gray-600 mb-1.5">
                Your opinion *
                <span className="font-normal text-gray-400"> — leave a blank line between paragraphs</span>
              </span>
              <textarea rows={14} className={input} value={editing.body || ''} onChange={set('body')}
                maxLength={LIMITS.body} />
              <span className="mt-1 flex justify-between text-[11px]">
                <span className={wordCount(editing.body) < MIN_BODY_WORDS ? 'text-gray-400' : 'text-green-700'}>
                  {wordCount(editing.body)} words {wordCount(editing.body) < MIN_BODY_WORDS && `(at least ${MIN_BODY_WORDS} to submit)`}
                </span>
              </span>
              {showErr('body') && <span className="mt-1 block text-[11px] text-red-600">{showErr('body')}</span>}
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => save('submit')} disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                <Send size={14} aria-hidden="true" />
                {busy ? 'Sending…' : 'Submit for review'}
              </button>
              <button onClick={() => save('draft')} disabled={busy}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700">
                Save draft
              </button>
              <button onClick={() => { setEditing(null); setErrors({}); setTried(false); }}
                className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
            </div>
          </div>
        )}

        {/* ── The member's pieces ── */}
        {rows === null && <p className="text-sm text-gray-400">Loading…</p>}

        {rows !== null && !rows.length && !editing && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
            <PenLine size={26} className="mx-auto mb-3" style={{ color: C.green }} aria-hidden="true" />
            <p className="font-bold" style={{ color: C.deep }}>You have not written an opinion yet</p>
            <p className="mt-1.5 text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
              Share your view on education, leadership, service — anything that matters for Roundu.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {(rows || []).map(o => {
            const tone = TONE[o.status] || TONE.draft;
            return (
              <div key={o.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[15px]" style={{ color: C.deep }}>
                    {o.title || 'Untitled'}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: tone.bg, color: tone.fg }}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                  <span className="text-[11px] text-gray-400 ml-auto">
                    {fmt(o.updated_at)}
                  </span>
                </div>

                <p className="mt-1.5 text-[12.5px] text-gray-500 leading-relaxed">
                  {STATUS_HELP[o.status]}
                </p>

                {/* The committee's reply. The reason someone was asked to change
                    something is the most useful thing on this page. */}
                {o.review_note && ['changes_requested', 'rejected'].includes(o.status) && (
                  <div className="mt-3 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed"
                    style={{ borderColor: '#FCD34D', background: '#FFFBEB', color: '#78350F' }}>
                    <b>From the committee: </b>{o.review_note}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
                  {o.status !== 'rejected' && (
                    <button onClick={() => { setEditing({ ...o }); setTried(false); setErrors({}); }}
                      className="font-bold hover:underline" style={{ color: C.green }}>
                      {o.status === 'published' ? 'Edit (goes for re-approval)' : 'Edit'}
                    </button>
                  )}
                  {o.status === 'published' && o.slug && (
                    <a href={`/media/opinions/${o.slug}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold hover:underline" style={{ color: C.green }}>
                      View live <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  )}
                  {o.status !== 'published' && (
                    <button onClick={() => remove(o)}
                      className="inline-flex items-center gap-1 text-red-500 hover:underline ml-auto">
                      <Trash2 size={12} aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>

                {o.status === 'published' && <Reception o={o} />}
              </div>
            );
          })}
        </div>
      </div>
    </MemberShell>
  );
}
