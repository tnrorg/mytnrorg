'use client';
import { useEffect, useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { COLORS } from '@/lib/design/tokens';
import {
  COMMENT_MAX, cleanComment, validateComment, commentParagraphs, timeAgo,
} from '@/lib/opinionComments';

/* The comment thread under an opinion.
 *
 * Members only, and every comment carries a real name and TNR number. That is
 * a moderation decision as much as a technical one: people write differently
 * under their own name in front of their own community, and it means there is
 * always someone to speak to when a comment goes wrong.
 *
 * Comments appear immediately. The writer, the author of the piece, and any
 * admin can remove one.
 */

function authHeader() {
  try {
    const t = localStorage.getItem('tnr_member_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export default function OpinionComments({ slug }) {
  const [rows, setRows] = useState(null);        // null = loading
  const [authorId, setAuthorId] = useState(null);
  const [me, setMe] = useState(undefined);       // undefined = unknown, null = signed out
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!slug) return;
    let off = false;

    fetch(`/api/public/opinions/comments?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
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

  async function post(e) {
    e?.preventDefault?.();
    const body = cleanComment(text);
    const problem = validateComment(body);
    if (problem) { setNote(problem); return; }

    setBusy(true); setNote('');
    try {
      const r = await fetch('/api/public/opinions/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ slug, body }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        setNote(j?.message || 'Could not post that just now.');
      } else {
        setRows(list => [...(list || []), j.comment]);
        setText('');
      }
    } catch {
      setNote('You appear to be offline.');
    }
    setBusy(false);
  }

  async function remove(c) {
    if (!confirm('Remove this comment?')) return;
    try {
      const r = await fetch(`/api/public/opinions/comments?id=${encodeURIComponent(c.id)}`, {
        method: 'DELETE', headers: authHeader(),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setNote(j?.message || 'Could not remove that comment.'); return; }
      setRows(list => (list || []).filter(x => x.id !== c.id));
    } catch {
      setNote('You appear to be offline.');
    }
  }

  // Mirrors the server's rule. The server decides; this only draws the button.
  const mayRemove = (c) =>
    !!me && (c.member_id === me.id || (authorId && me.id === authorId));

  const count = rows?.length || 0;

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
        <form onSubmit={post} className="mt-4 flex gap-3">
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
        <p className="mt-6 text-[13px] text-gray-400">
          No comments yet. Be the first to respond.
        </p>
      )}

      <div className="mt-6 space-y-5">
        {(rows || []).map(c => (
          <article key={c.id} className="flex gap-3">
            <Avatar src={c.author?.photo_url} gender={c.author?.gender}
              name={c.author?.full_name || 'Member'} className="w-9 h-9 shrink-0" />
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
                {/* The writer of the piece, marked, so a reply from them reads
                    as one rather than as another commenter. */}
                {authorId && c.member_id === authorId && (
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(23,107,73,.1)', color: COLORS.green700 }}>Author</span>
                )}
                <span className="text-[11px] text-gray-400">{timeAgo(c.created_at)}</span>

                {mayRemove(c) && (
                  <button onClick={() => remove(c)}
                    aria-label="Remove this comment" title="Remove"
                    className="ml-auto text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              {/* Rendered as text, never as markup — React escapes each
                  paragraph. That is why comments are stored plain. */}
              <div className="mt-1 space-y-2">
                {commentParagraphs(c.body).map((p, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-gray-700">{p}</p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
