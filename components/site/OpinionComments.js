'use client';
import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Pencil, CornerDownRight } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { COLORS } from '@/lib/design/tokens';
import {
  COMMENT_MAX, cleanComment, validateComment, commentParagraphs, timeAgo,
  canEdit, EDIT_WINDOW_MINUTES,
} from '@/lib/opinionComments';

/* The comment thread under an opinion.
 *
 * Members only, and every comment carries a real name and TNR number. That is
 * a moderation decision as much as a technical one: people write differently
 * under their own name in front of their own community.
 *
 * Replies go ONE level deep. Replying to a reply attaches to the same parent,
 * so the thread never becomes a staircase — unreadable on a phone, and
 * impossible for a moderator to follow. The server flattens it too, so this
 * holds regardless of what the browser sends.
 */

function authHeader() {
  try {
    const t = localStorage.getItem('tnr_member_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

const api = '/api/public/opinions/comments';

export default function OpinionComments({ slug }) {
  const [rows, setRows] = useState(null);        // flat list, oldest first
  const [authorId, setAuthorId] = useState(null);
  const [me, setMe] = useState(undefined);       // undefined = unknown, null = signed out
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [replyTo, setReplyTo] = useState(null);  // comment id being answered
  const [editing, setEditing] = useState(null);  // comment id being edited

  useEffect(() => {
    if (!slug) return;
    let off = false;

    fetch(`${api}?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        setRows(j?.ok ? (j.comments || []) : []);
        setAuthorId(j?.author_id || null);
      })
      .catch(() => { if (!off) setRows([]); });

    // Who is reading. Asked of the server rather than read from the token, so
    // an expired session shows the sign-in prompt instead of a write box that
    // will refuse them.
    const auth = authHeader();
    if (!auth.Authorization) { setMe(null); return () => { off = true; }; }
    fetch('/api/member/me', { headers: auth, cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setMe(j?.ok && j.member ? j.member : null); })
      .catch(() => { if (!off) setMe(null); });

    return () => { off = true; };
  }, [slug]);

  async function post(body, parentId) {
    const problem = validateComment(body);
    if (problem) { setNote(problem); return false; }
    setBusy(true); setNote('');
    try {
      const r = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ slug, body: cleanComment(body), parent_id: parentId || null }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setNote(j?.message || 'Could not post that just now.'); setBusy(false); return false; }
      setRows(list => [...(list || []), j.comment]);
      setBusy(false);
      return true;
    } catch {
      setNote('You appear to be offline.');
      setBusy(false);
      return false;
    }
  }

  async function saveEdit(id, body) {
    const problem = validateComment(body);
    if (problem) { setNote(problem); return false; }
    try {
      const r = await fetch(api, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ id, body: cleanComment(body) }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setNote(j?.message || 'Could not save that change.'); return false; }
      setRows(list => list.map(c => c.id === id ? { ...c, body: j.body, edited_at: j.edited_at } : c));
      return true;
    } catch {
      setNote('You appear to be offline.');
      return false;
    }
  }

  async function remove(c) {
    const hasReplies = (rows || []).some(x => x.parent_id === c.id);
    if (!confirm(hasReplies
      ? 'Remove this comment? The replies under it will go too.'
      : 'Remove this comment?')) return;
    try {
      const r = await fetch(`${api}?id=${encodeURIComponent(c.id)}`, {
        method: 'DELETE', headers: authHeader(),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setNote(j?.message || 'Could not remove that comment.'); return; }
      // Drop the comment and anything hanging off it, matching the cascade.
      setRows(list => list.filter(x => x.id !== c.id && x.parent_id !== c.id));
    } catch {
      setNote('You appear to be offline.');
    }
  }

  // Mirrors the server's rules. The server decides; this only draws buttons.
  const mayRemove = (c) => !!me && (c.member_id === me.id || (authorId && me.id === authorId));
  const mayEdit = (c) => canEdit({ comment: c, viewerMemberId: me?.id });

  const all = rows || [];
  const tops = all.filter(c => !c.parent_id);
  const repliesOf = (id) => all.filter(c => c.parent_id === id);
  const count = all.length;

  return (
    <section className="mt-10 pt-8 border-t border-gray-200">
      <h2 className="flex items-center gap-2 text-lg font-black" style={{ color: COLORS.green900 }}>
        <MessageSquare size={18} strokeWidth={2.4} aria-hidden="true" />
        {count === 0 ? 'Comments' : count === 1 ? '1 Comment' : `${count} Comments`}
      </h2>

      {/* ── Write box ── */}
      {me === undefined ? (
        <div className="mt-4 h-24 rounded-2xl bg-gray-50 animate-pulse" />
      ) : me ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (await post(text, null)) setText('');
        }} className="mt-4 flex gap-3">
          <Avatar src={me.photo_url} gender={me.gender} name={me.full_name || 'Member'}
            className="w-9 h-9 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              maxLength={COMMENT_MAX}
              placeholder={`Share your thoughts, ${(me.first_name || me.full_name || '').split(' ')[0]}…`}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[14px]
                text-gray-800 leading-relaxed outline-none focus:border-[#0B6B4F] resize-y" />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={busy || !cleanComment(text)}
                className="rounded-full px-5 py-2 text-sm font-bold text-white transition disabled:opacity-40"
                style={{ background: COLORS.green700 }}>
                {busy ? 'Posting…' : 'Post comment'}
              </button>
              <span className="text-[11px] text-gray-400">
                Posted publicly as {me.full_name}. Please keep it respectful.
              </span>
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-center">
          <p className="text-[13.5px] text-gray-600">
            Comments are open to TNR members, so every comment carries a name.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            <a href="/member/login"
              className="rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ background: COLORS.green700 }}>Sign in to comment</a>
            <a href="/membership/apply"
              className="text-sm font-bold hover:underline" style={{ color: COLORS.green700 }}>
              Become a member →
            </a>
          </div>
        </div>
      )}

      {note && <p className="mt-3 text-[12.5px] font-semibold text-amber-700">{note}</p>}

      {/* ── Thread ── */}
      {rows === null && (
        <div className="mt-6 space-y-4">
          {[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-gray-50 animate-pulse" />)}
        </div>
      )}

      {rows !== null && count === 0 && (
        <p className="mt-6 text-[13px] text-gray-400">No comments yet. Be the first to respond.</p>
      )}

      <div className="mt-6 space-y-6">
        {tops.map(c => (
          <div key={c.id}>
            <Comment c={c} me={me} authorId={authorId}
              mayEdit={mayEdit(c)} mayRemove={mayRemove(c)}
              editing={editing === c.id}
              onEdit={() => setEditing(c.id)} onCancelEdit={() => setEditing(null)}
              onSaveEdit={async (v) => { if (await saveEdit(c.id, v)) setEditing(null); }}
              onRemove={() => remove(c)}
              onReply={me ? () => setReplyTo(replyTo === c.id ? null : c.id) : null} />

            {/* Replies, indented once and only once. */}
            <div className="mt-4 ml-6 sm:ml-12 space-y-4 border-l-2 border-gray-100 pl-4">
              {repliesOf(c.id).map(r => (
                <Comment key={r.id} c={r} me={me} authorId={authorId} compact
                  mayEdit={mayEdit(r)} mayRemove={mayRemove(r)}
                  editing={editing === r.id}
                  onEdit={() => setEditing(r.id)} onCancelEdit={() => setEditing(null)}
                  onSaveEdit={async (v) => { if (await saveEdit(r.id, v)) setEditing(null); }}
                  onRemove={() => remove(r)}
                  // Replying to a reply answers the same thread — the server
                  // would flatten it anyway, and this makes that visible.
                  onReply={me ? () => setReplyTo(replyTo === c.id ? null : c.id) : null} />
              ))}

              {replyTo === c.id && me && (
                <ReplyBox me={me} busy={busy}
                  onCancel={() => setReplyTo(null)}
                  onSend={async (v) => { if (await post(v, c.id)) setReplyTo(null); }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* One comment. Handles its own edit box so typing in it does not re-render
   the entire thread on every keystroke. */
function Comment({
  c, me, authorId, compact = false, mayEdit, mayRemove, editing,
  onEdit, onCancelEdit, onSaveEdit, onRemove, onReply,
}) {
  const [draft, setDraft] = useState(c.body);
  useEffect(() => { setDraft(c.body); }, [c.body, editing]);

  const size = compact ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <article className="flex gap-3">
      <Avatar src={c.author?.photo_url} gender={c.author?.gender}
        name={c.author?.full_name || 'Member'} className={`${size} shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {c.author?.membership_id ? (
            <a href={`/members/${c.author.membership_id}`}
              className="text-[13.5px] font-bold hover:underline" style={{ color: COLORS.green900 }}>
              {c.author.full_name}
            </a>
          ) : (
            <span className="text-[13.5px] font-bold" style={{ color: COLORS.green900 }}>
              {c.author?.full_name || 'TNR Member'}
            </span>
          )}
          {/* The writer of the piece, marked, so a reply from them reads as
              one rather than as another commenter. */}
          {authorId && c.member_id === authorId && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: 'rgba(23,107,73,.1)', color: COLORS.green700 }}>Author</span>
          )}
          <span className="text-[11px] text-gray-400">{timeAgo(c.created_at)}</span>
          {/* Marked, not hidden. A comment that silently changed after people
              replied to it rewrites the conversation around them. */}
          {c.edited_at && <span className="text-[11px] text-gray-300 italic">edited</span>}
        </div>

        {editing ? (
          <div className="mt-2">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3}
              maxLength={COMMENT_MAX} autoFocus
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[14px]
                text-gray-800 leading-relaxed outline-none focus:border-[#0B6B4F] resize-y" />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => onSaveEdit(draft)} disabled={!cleanComment(draft)}
                className="rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
                style={{ background: COLORS.green700 }}>Save</button>
              <button onClick={onCancelEdit}
                className="text-[12.5px] font-semibold text-gray-500 hover:underline">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Rendered as text, never as markup — React escapes each
                paragraph. That is why comments are stored plain. */}
            <div className="mt-1 space-y-2">
              {commentParagraphs(c.body).map((p, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-gray-700">{p}</p>
              ))}
            </div>

            <div className="mt-1.5 flex items-center gap-3">
              {onReply && (
                <button onClick={onReply}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gray-500 hover:text-[#176B49]">
                  <CornerDownRight size={11} strokeWidth={2.4} aria-hidden="true" /> Reply
                </button>
              )}
              {mayEdit && (
                <button onClick={onEdit}
                  title={`Editable for ${EDIT_WINDOW_MINUTES} minutes after posting`}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gray-500 hover:text-[#176B49]">
                  <Pencil size={11} strokeWidth={2.4} aria-hidden="true" /> Edit
                </button>
              )}
              {mayRemove && (
                <button onClick={onRemove}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gray-400 hover:text-red-500">
                  <Trash2 size={11} strokeWidth={2.4} aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

/** The box that opens under the comment being answered. */
function ReplyBox({ me, busy, onSend, onCancel }) {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2.5">
      <Avatar src={me.photo_url} gender={me.gender} name={me.full_name || 'Member'}
        className="w-7 h-7 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <textarea value={v} onChange={e => setV(e.target.value)} rows={2} autoFocus
          maxLength={COMMENT_MAX} placeholder="Write a reply…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13.5px]
            text-gray-800 leading-relaxed outline-none focus:border-[#0B6B4F] resize-y" />
        <div className="mt-1.5 flex items-center gap-2">
          <button onClick={() => onSend(v)} disabled={busy || !cleanComment(v)}
            className="rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
            style={{ background: COLORS.green700 }}>
            {busy ? 'Sending…' : 'Reply'}
          </button>
          <button onClick={onCancel}
            className="text-[12.5px] font-semibold text-gray-500 hover:underline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
