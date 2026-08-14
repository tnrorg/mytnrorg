'use client';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { COLORS } from '@/lib/design/tokens';

/* Like button for a published opinion.
 *
 * Shows the total and whether this reader is part of it. Never a name — who
 * liked a piece is attached only in the author's own portal.
 *
 * A signed-out visitor is remembered by a random key in localStorage, so they
 * can undo a like and cannot register it twice from the same browser.
 * localStorage rather than sessionStorage on purpose: a like is a lasting
 * statement, unlike a view, which should count again on a later visit.
 */

const ANON_KEY = 'tnr_like_key';

function browserKey() {
  try {
    let k = localStorage.getItem(ANON_KEY);
    if (!k) {
      k = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now());
      localStorage.setItem(ANON_KEY, k);
    }
    return k;
  } catch {
    // Private browsing can refuse storage. A per-page key still lets the tap
    // register; it just cannot be undone after a reload.
    return 'nostore-' + Math.random().toString(36).slice(2) + Date.now();
  }
}

function authHeader() {
  try {
    const t = localStorage.getItem('tnr_member_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export default function OpinionLike({ slug, initial = 0 }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initial);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!slug) return;
    let off = false;
    const k = browserKey();
    fetch(`/api/public/opinions/like?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(k)}`,
      { headers: authHeader(), cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        setLiked(!!j?.liked);
        if (typeof j?.likes === 'number') setCount(j.likes);
        setReady(true);
      })
      .catch(() => { if (!off) setReady(true); });
    return () => { off = true; };
  }, [slug]);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setNote('');
    // Flip immediately, and move the number with it. A like that waits on the
    // network feels broken; the server's own total replaces this a moment
    // later, so a guess that is briefly off by one costs nothing.
    setLiked(next);
    setCount(c => Math.max(0, c + (next ? 1 : -1)));
    try {
      const r = await fetch('/api/public/opinions/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ slug, liked: next, key: browserKey() }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        setLiked(!next);                                        // put it back
        setCount(c => Math.max(0, c + (next ? -1 : 1)));
        setNote(j?.message || 'Could not save that just now.');
      } else {
        setLiked(!!j.liked);
        if (typeof j.likes === 'number') setCount(j.likes);      // the real total
      }
    } catch {
      setLiked(!next);
      setCount(c => Math.max(0, c + (next ? -1 : 1)));
      setNote('You appear to be offline.');
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={toggle} disabled={!ready || busy}
        aria-pressed={liked}
        aria-label={liked ? 'Remove your like' : 'Like this opinion'}
        className={`group inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold
          transition-all duration-standard disabled:opacity-50
          ${liked
            ? 'border-transparent text-white'
            : 'border-gray-200 text-gray-600 hover:border-[rgba(23,107,73,.35)] hover:text-[#176B49]'}`}
        style={liked ? { background: COLORS.green700 } : undefined}>
        <Heart size={16} strokeWidth={2.5} aria-hidden="true"
          fill={liked ? 'currentColor' : 'none'}
          className={`transition-transform duration-micro ${liked ? 'scale-110' : 'group-hover:scale-110'}`} />
        {liked ? 'Liked' : 'Like'}
        {/* The total sits inside the button, so the number a reader is about
            to change is the one they are looking at. */}
        {count > 0 && (
          <span className={`ml-0.5 tabular-nums ${liked ? 'text-white/75' : 'text-gray-400'}`}>
            {count.toLocaleString()}
          </span>
        )}
      </button>

      <span className="text-[12px] text-gray-500">
        {liked
          ? 'The writer will see that you liked this.'
          : 'Let the writer know this was worth reading.'}
      </span>

      {note && <span className="w-full text-[12px] text-amber-700">{note}</span>}
    </div>
  );
}
