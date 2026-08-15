'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch, aDel } from './adminApi';
import { Card } from './ui';
import { STATUS_LABEL, paragraphs, wordCount } from '@/lib/opinions';

const TONE = {
  draft:             'bg-gray-500/15 text-gray-300 border-gray-500/30',
  pending:           'bg-amber-500/15 text-amber-300 border-amber-500/30',
  published:         'bg-green-500/15 text-green-300 border-green-500/30',
  changes_requested: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rejected:          'bg-red-500/15 text-red-300 border-red-500/30',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

/* Review queue for member-written Opinions.
 *
 * Reads the DRAFT columns — that is what is being judged. The published
 * columns only change when Publish is pressed, which is what stops a live page
 * shifting under a reader while someone is mid-edit.
 */
export default function OpinionsTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [view, setView] = useState('articles');      // articles | comments
  const [status, setStatus] = useState('pending');   // the queue is the default view
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    aGet('/api/admin/opinions?status=' + status).then(r => {
      setLoading(false);
      if (r?.ok) { setRows(r.opinions || []); setCounts(r.counts || {}); setErr(''); }
      else setErr(r?.detail || r?.message || 'Could not load opinions.');
    }).catch(e => { setLoading(false); setErr(e.message || 'Request failed.'); });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function act(o, action) {
    // Both of these tell the author something. Sending them back with a blank
    // reply gives them nothing to work with, so the server insists too.
    if (['request_changes', 'reject'].includes(action) && !note.trim()) {
      return toast?.('Write a note explaining what the author should do.', 'err');
    }
    if (action === 'reject' && !confirm(
      `Reject “${o.title}”?\n\nThis is final — the author cannot edit and resubmit it.`)) return;

    const r = await aPatch('/api/admin/opinions/' + o.id, { action, note });
    if (!r.ok) return toast?.(r.message || 'Failed', 'err');
    toast?.({
      publish: 'Published',
      request_changes: 'Sent back to the author',
      reject: 'Rejected',
      unpublish: 'Withdrawn from the site',
    }[action] || 'Updated', 'ok');
    setNote(''); setOpenId(null); load();
  }

  async function remove(o) {
    if (!confirm(`Permanently delete “${o.title}”?\n\n` +
      `This is someone's writing and cannot be undone. Unpublishing is usually the right action.`)) return;
    const r = await aDel('/api/admin/opinions/' + o.id);
    if (!r?.ok) return toast?.(r?.message || 'Could not delete.', 'err');
    toast?.('Deleted', 'ok'); load();
  }

  const chip = (v, label) => (
    <button onClick={() => { setStatus(v); setOpenId(null); }}
      className={`px-3 py-1.5 rounded-lg text-xs border transition ${status === v
        ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
        : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Opinions</h2>
        <p className="text-sm text-tnr-cream/50 mt-1">
          Member-written pieces. Approving one copies it to the public site under Media → Opinions.
          {counts.pending > 0 && <span className="text-tnr-gold font-semibold"> {counts.pending} awaiting review.</span>}
        </p>
      </div>

      {err && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm space-y-1">
          <div className="font-semibold">Opinions not ready</div>
          <div className="text-red-200/80 text-xs">{err}</div>
        </div>
      )}

      {/* Articles or the comment queue. Comments live here rather than in
          their own tab because they belong to this section, and a tab that is
          empty most weeks gets ignored. */}
      <div className="flex gap-1.5 border-b border-tnr-line pb-3">
        {[['articles', 'Articles'], ['comments', 'Comments']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${view === k
              ? 'bg-tnr-gold text-tnr-black' : 'text-tnr-cream/60 hover:bg-white/5'}`}>{l}</button>
        ))}
      </div>

      {view === 'comments' && <CommentQueue toast={toast} />}

      {view === 'articles' && <>
      <div className="flex flex-wrap gap-1.5">
        {chip('pending', 'Awaiting review')}
        {chip('published', 'Published')}
        {chip('changes_requested', 'Changes requested')}
        {chip('rejected', 'Rejected')}
        {chip('draft', 'Drafts')}
        {chip('', 'All')}
      </div>

      {!rows.length && !err && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {loading ? 'Loading…' : 'Nothing here.'}
        </div></Card>
      )}

      {rows.map(o => {
        const open = openId === o.id;
        return (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center gap-2">
              <button className="font-bold text-tnr-cream text-left"
                onClick={() => { setOpenId(open ? null : o.id); setNote(o.review_note || ''); }}>
                {o.title || '(untitled)'}
              </button>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${TONE[o.status] || ''}`}>
                {STATUS_LABEL[o.status] || o.status}
              </span>
              <span className="text-[11px] text-tnr-cream/50">
                {o.author?.full_name || 'Unknown author'}
              </span>
              {o.author?.membership_id && (
                <span className="text-[11px] font-mono text-tnr-gold/80">{o.author.membership_id}</span>
              )}
              <span className="text-[11px] text-tnr-cream/40">{wordCount(o.body)} words</span>
              <span className="text-[11px] text-tnr-cream/40 ml-auto">
                {o.status === 'pending' ? `submitted ${fmt(o.submitted_at)}` : fmt(o.updated_at)}
              </span>
              <button className="btn-ghost !py-1 !px-3 text-xs"
                onClick={() => { setOpenId(open ? null : o.id); setNote(o.review_note || ''); }}>
                {open ? 'Collapse' : 'Read'}
              </button>
            </div>

            {open && (
              <div className="mt-4 space-y-4">
                {o.cover_url && (
                  <img src={o.cover_url} alt="" className="w-full max-h-64 object-cover rounded-xl" />
                )}

                <p className="text-sm font-semibold text-tnr-cream/90">{o.summary}</p>

                <div className="rounded-xl bg-black/25 p-4 space-y-3 max-h-[420px] overflow-y-auto">
                  {paragraphs(o.body).map((p, i) => (
                    <p key={i} className="text-[13.5px] leading-relaxed text-tnr-cream/85">{p}</p>
                  ))}
                </div>

                {o.status === 'published' && (
                  <p className="text-[11px] text-tnr-cream/40">
                    Live at <a href={`/media/opinions/${o.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-tnr-goldLight hover:underline">/media/opinions/{o.slug}</a>
                    {' · '}published {fmt(o.published_at)}
                    {o.published_title !== o.title && (
                      <span className="text-amber-300"> · an edited version is waiting for approval</span>
                    )}
                  </p>
                )}

                <label className="block">
                  <span className="label">
                    Note to the author
                    <span className="text-tnr-cream/40 font-normal"> — required when asking for changes or rejecting</span>
                  </span>
                  <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="What should they change, or why is it not being published?" />
                </label>

                <div className="flex flex-wrap gap-2">
                  {o.status !== 'published' && (
                    <button className="btn-gold !py-1.5 !px-4 text-xs" onClick={() => act(o, 'publish')}>
                      Approve &amp; publish
                    </button>
                  )}
                  {o.status === 'published' && (
                    <>
                      <button className="btn-gold !py-1.5 !px-4 text-xs" onClick={() => act(o, 'publish')}>
                        Approve the edit
                      </button>
                      <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={() => act(o, 'unpublish')}>
                        Withdraw from site
                      </button>
                    </>
                  )}
                  {o.status !== 'rejected' && (
                    <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={() => act(o, 'request_changes')}>
                      Request changes
                    </button>
                  )}
                  {!['rejected', 'published'].includes(o.status) && (
                    <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={() => act(o, 'reject')}>
                      Reject
                    </button>
                  )}
                  <button className="text-xs text-red-400 hover:underline ml-auto" onClick={() => remove(o)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      </>}
    </div>
  );
}

/* Every comment across every article, newest first.
 *
 * Comments go live the moment they are posted, so this is the place a problem
 * is actually found. Scanning one list beats opening thirty articles, and the
 * newest entry is the one least likely to have been seen by anyone yet.
 *
 * Removal is a soft delete: hidden from the public thread, still on the record
 * with the name of whoever removed it, and restorable. Moderation calls get
 * made quickly and are sometimes wrong.
 */
function CommentQueue({ toast }) {
  const [rows, setRows] = useState([]);
  const [removed, setRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState('');

  const load = () => {
    setLoading(true);
    aGet('/api/admin/opinions/comments' + (removed ? '?removed=1' : '')).then(r => {
      setRows(r.ok ? (r.comments || []) : []);
      setHint(r.hint || '');
      setLoading(false);
    });
  };
  useEffect(load, [removed]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(c) {
    if (!confirm('Remove this comment from the public page?')) return;
    const r = await aDel('/api/admin/opinions/comments?id=' + c.id);
    if (!r.ok) return toast?.(r.message || 'Failed.', 'err');
    toast?.('Comment removed.', 'ok');
    setRows(list => list.filter(x => x.id !== c.id));
  }

  async function restore(c) {
    const r = await aPatch('/api/admin/opinions/comments?id=' + c.id, {});
    if (!r.ok) return toast?.(r.message || 'Failed.', 'err');
    toast?.('Comment restored.', 'ok');
    setRows(list => list.filter(x => x.id !== c.id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[[false, 'Live'], [true, 'Removed']].map(([k, l]) => (
          <button key={l} onClick={() => setRemoved(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${removed === k
              ? 'bg-tnr-gold text-tnr-black' : 'text-tnr-cream/60 hover:bg-white/5 border border-tnr-line'}`}>
            {l}
          </button>
        ))}
        <span className="text-[11px] text-tnr-cream/40 ml-1">
          Comments appear immediately. Members can remove their own; article authors can remove any on their piece.
        </span>
      </div>

      {hint && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          {hint}
        </div>
      )}

      {!rows.length && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {loading ? 'Loading…' : removed ? 'Nothing has been removed.' : 'No comments yet.'}
        </div></Card>
      )}

      {rows.map(c => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-baseline gap-2 text-xs">
            <span className="font-bold text-tnr-cream">{c.author?.full_name || 'Unknown member'}</span>
            <span className="text-tnr-cream/40">{c.author?.membership_id}</span>
            <span className="text-tnr-cream/40">{new Date(c.created_at).toLocaleString()}</span>
            {c.deleted_by && <span className="text-red-300">removed by {c.deleted_by}</span>}
          </div>

          <p className="mt-2 text-sm text-tnr-cream/80 leading-relaxed whitespace-pre-wrap">{c.body}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {c.opinion?.slug && (
              <a href={`/media/opinions/${c.opinion.slug}`} target="_blank" rel="noopener noreferrer"
                className="text-tnr-goldLight hover:underline">
                on “{c.opinion.published_title || c.opinion.slug}” ↗
              </a>
            )}
            {removed
              ? <button className="text-tnr-cream/60 hover:underline ml-auto" onClick={() => restore(c)}>Restore</button>
              : <button className="text-red-400 hover:underline ml-auto" onClick={() => remove(c)}>Remove</button>}
          </div>
        </Card>
      ))}
    </div>
  );
}
