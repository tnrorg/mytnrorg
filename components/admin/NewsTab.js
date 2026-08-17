'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aDel } from './adminApi';
import { Card } from './ui';
import { CATEGORIES, LIMITS, validateNews, wordCount, fmtDate } from '@/lib/news';

const BLANK = {
  title: '', summary: '', body: '', category: 'News', cover_url: '', cover_data: '',
  pinned: false, publish_at: '', expires_at: '', author_name: 'TNR Media Team',
};

/* News & Announcements.
 *
 * Drafts save without validation — a draft is somewhere to think, and refusing
 * to keep a headline because the body is empty loses the headline. The rules
 * apply at Publish, which is when they matter.
 */
export default function NewsTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');        // '' = all
  const [editing, setEditing] = useState(null);    // BLANK-shaped, or null
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    aGet('/api/admin/news' + (status ? `?status=${status}` : '')).then(r => {
      setRows(r.ok ? (r.posts || []) : []);
      setCounts(r.counts || {});
      setHint(r.ok ? '' : (r.hint || r.message || ''));
      setLoading(false);
    });
    // Answers "why isn't this on the site?" without anyone having to guess.
    aGet('/api/admin/news/diagnose').then(r => setDiag(r?.ok ? r : null));
  };
  useEffect(load, [status]);   // eslint-disable-line react-hooks/exhaustive-deps

  function pickCover(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast?.('Cover image must be under 4 MB.', 'err');
    const fr = new FileReader();
    // Only cover_data is sent for a new image; cover_url is what the server
    // already has. Sending both would upload the same picture twice.
    fr.onload = () => setEditing(e => ({ ...e, cover_data: String(fr.result), cover_url: '' }));
    fr.readAsDataURL(file);
  }

  async function save(action) {
    const problems = validateNews(editing, { publishing: action === 'publish' });
    setErrs(problems);
    if (Object.keys(problems).length) return toast?.('Please check the highlighted fields.', 'err');

    setBusy(true);
    const r = await aPost('/api/admin/news', { ...editing, action });
    setBusy(false);
    if (!r.ok) {
      setErrs(r.errors || {});
      return toast?.(r.message || r.detail || 'Could not save.', 'err');
    }
    toast?.(action === 'publish' ? 'Published to the website.'
      : action === 'unpublish' ? 'Moved back to drafts.' : 'Saved.', 'ok');
    setEditing(null); load();
  }

  async function remove(p) {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    const r = await aDel('/api/admin/news?id=' + p.id);
    if (!r.ok) return toast?.(r.message || 'Failed.', 'err');
    toast?.('Deleted.', 'ok'); load();
  }

  const F = ({ label, err, hint: h, children }) => (
    <div>
      <label className="block text-xs uppercase tracking-wide text-tnr-cream/50 mb-1.5">{label}</label>
      {children}
      {h && !err && <p className="mt-1 text-[11px] text-tnr-cream/40">{h}</p>}
      {err && <p className="mt-1 text-[11px] font-semibold text-red-300">{err}</p>}
    </div>
  );
  const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';

  // ── Editor ────────────────────────────────────────────────────────────────
  if (editing) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-tnr-cream">
          {editing.id ? 'Edit post' : 'New post'}
        </h2>
        <button onClick={() => { setEditing(null); setErrs({}); }}
          className="text-sm text-tnr-cream/60 hover:underline">← Back to all news</button>
      </div>

      <Card>
        <div className="space-y-4">
          <F label="Headline" err={errs.title}
            hint={`${(editing.title || '').length}/${LIMITS.title}`}>
            <input value={editing.title} maxLength={LIMITS.title}
              onChange={e => setEditing({ ...editing, title: e.target.value })}
              className={input} placeholder="e.g. TNR opens applications for the 2026 scholarship" />
          </F>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Category">
              <select value={editing.category} className={input}
                onChange={e => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Byline" hint="Shown on the article. Usually the team, not a person.">
              <input value={editing.author_name || ''} className={input}
                onChange={e => setEditing({ ...editing, author_name: e.target.value })} />
            </F>
          </div>

          <F label="Summary" err={errs.summary}
            hint="One or two lines. This is what appears on cards and in WhatsApp and Facebook previews.">
            <textarea value={editing.summary} rows={2} maxLength={LIMITS.summary}
              onChange={e => setEditing({ ...editing, summary: e.target.value })}
              className={input} />
          </F>

          <F label="Cover image" hint="JPG, PNG or WEBP, under 4 MB. Landscape works best.">
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => pickCover(e.target.files?.[0])}
              className="text-sm text-tnr-cream/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg
                file:border-0 file:bg-tnr-gold file:text-tnr-black file:font-semibold file:text-xs" />
            {(editing.cover_data || editing.cover_url) && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editing.cover_data || editing.cover_url} alt=""
                  className="w-40 aspect-[16/9] object-cover rounded-lg border border-white/10" />
                <button onClick={() => setEditing({ ...editing, cover_data: '', cover_url: '' })}
                  className="text-xs text-red-300 hover:underline">Remove</button>
              </div>
            )}
          </F>

          <F label="Article" err={errs.body}
            hint={`${wordCount(editing.body)} words · leave a blank line between paragraphs`}>
            <textarea value={editing.body} rows={14} maxLength={LIMITS.body}
              onChange={e => setEditing({ ...editing, body: e.target.value })}
              className={input + ' leading-relaxed font-normal'} />
          </F>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Publish at" hint="Leave empty to publish immediately.">
              <input type="datetime-local" className={input}
                value={(editing.publish_at || '').slice(0, 16)}
                onChange={e => setEditing({ ...editing, publish_at: e.target.value })} />
            </F>
            <F label="Hide after" hint="Optional. For a notice that stops being true.">
              <input type="datetime-local" className={input}
                value={(editing.expires_at || '').slice(0, 16)}
                onChange={e => setEditing({ ...editing, expires_at: e.target.value })} />
            </F>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={!!editing.pinned} className="w-4 h-4"
              onChange={e => setEditing({ ...editing, pinned: e.target.checked })} />
            <span className="text-sm text-tnr-cream/80">
              Pin to the top — stays first regardless of what is posted after it
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-tnr-line">
            <button onClick={() => save('save')} disabled={busy}
              className="btn-ghost !py-2 !px-4 text-sm">
              {busy ? 'Saving…' : 'Save draft'}
            </button>
            <button onClick={() => save('publish')} disabled={busy}
              className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
              {editing.status === 'published' ? 'Save & keep published' : 'Publish to website'}
            </button>
            {editing.status === 'published' && (
              <button onClick={() => save('unpublish')} disabled={busy}
                className="text-sm text-tnr-cream/60 hover:underline ml-auto">
                Unpublish
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );

  // ── List ──────────────────────────────────────────────────────────────────
  const chip = (k, label) => (
    <button onClick={() => setStatus(k)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${status === k
        ? 'bg-tnr-gold text-tnr-black' : 'text-tnr-cream/60 hover:bg-white/5 border border-tnr-line'}`}>
      {label}{k && counts[k] ? ` (${counts[k]})` : ''}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-xl font-bold text-tnr-cream">News &amp; Announcements</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            Official TNR posts. These appear under Media → News and on the home page.
            The scrolling ticker at the top of the site is separate — that is the
            Announcements tab, for one-line notices.
          </p>
        </div>
        <button onClick={() => { setEditing({ ...BLANK }); setErrs({}); }}
          className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm">
          + New post
        </button>
      </div>

      {hint && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          {hint}
        </div>
      )}

      {/* "Nothing is showing on the site" has four possible causes that all
          look identical from outside. This says which one it is. */}
      {diag && !diag.ready && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-xs space-y-1">
          <div className="font-bold">Nothing is live on the public site yet</div>
          <div className="text-amber-200/90">{diag.message}</div>
          <div className="text-amber-200/70"><b>Fix:</b> {diag.fix}</div>
          {diag.counts && (
            <div className="text-amber-200/50 pt-1">
              {diag.counts.total} total · {diag.counts.drafts} draft · {diag.counts.published} published
              {diag.counts.scheduled ? ` · ${diag.counts.scheduled} scheduled` : ''}
              {diag.counts.expired ? ` · ${diag.counts.expired} expired` : ''}
            </div>
          )}
        </div>
      )}
      {diag?.ready && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-200 text-xs">
          {diag.counts.live} post{diag.counts.live === 1 ? '' : 's'} live on the public site.
          {' '}<a href="/media/news" target="_blank" rel="noopener noreferrer" className="underline">View →</a>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chip('', 'All')}{chip('published', 'Published')}{chip('draft', 'Drafts')}
      </div>

      {!rows.length && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {loading ? 'Loading…' : 'No posts yet. Write the first one.'}
        </div></Card>
      )}

      {rows.map(p => {
        const scheduled = p.publish_at && new Date(p.publish_at) > new Date();
        return (
          <Card key={p.id}>
            <div className="flex gap-4">
              {p.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt="" className="w-28 aspect-[16/9] object-cover rounded-lg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-tnr-cream">{p.title || '(untitled)'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-tnr-cream/70">
                    {p.category}
                  </span>
                  {p.pinned && <span className="text-[10px] font-bold text-tnr-gold">PINNED</span>}
                  {p.status === 'draft' && <span className="text-[10px] font-bold text-tnr-cream/40">DRAFT</span>}
                  {scheduled && (
                    <span className="text-[10px] font-bold text-amber-300">
                      SCHEDULED · {fmtDate(p.publish_at)}
                    </span>
                  )}
                </div>
                {p.summary && <p className="mt-1 text-xs text-tnr-cream/50 line-clamp-2">{p.summary}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <button onClick={() => setEditing({ ...BLANK, ...p, cover_data: '' })}
                    className="text-tnr-goldLight hover:underline">Edit</button>
                  {p.status === 'published' && p.slug && (
                    <a href={`/media/news/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-tnr-cream/60 hover:underline">View live ↗</a>
                  )}
                  <span className="text-tnr-cream/30">
                    {p.views > 0 ? `${p.views} reads · ` : ''}{fmtDate(p.publish_at || p.created_at)}
                  </span>
                  <button onClick={() => remove(p)}
                    className="text-red-400 hover:underline ml-auto">Delete</button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
