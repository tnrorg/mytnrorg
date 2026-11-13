'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ResultRow, recordOpen } from './SearchResult';

/* ── Global search overlay ───────────────────────────────────────────────────
 *
 * A command palette on desktop, a full-screen sheet on a phone. Opened from
 * the navbar magnifier or with Ctrl/Cmd + K (the shortcut lives in SiteNav).
 *
 * Rendered into <body> through a portal. The navbar it is opened from is a
 * sticky, transformed capsule, and anything painted inside that is trapped in
 * its stacking context — the same trap the membership form's dropdown fell
 * into. Out here it sits above everything.
 *
 * Suggestions are real results from /api/public/search, fetched 250 ms after
 * the visitor stops typing, with the previous request cancelled — so a slow
 * answer for "sch" can never overwrite a fast one for "scholarship".
 */

const DEBOUNCE = 250;

export default function SearchOverlay({ open, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);       // last response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => { setMounted(true); }, []);

  // Reset on open, lock the page behind, focus the field.
  useEffect(() => {
    if (!open) return;
    setQ(''); setData(null); setError(''); setActive(-1);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => { document.body.style.overflow = prev; clearTimeout(t); };
  }, [open]);

  // Debounced, cancellable suggestions.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setData(null); setLoading(false); setError(''); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/public/search?mode=suggest&q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal, cache: 'no-store' });
        const j = await r.json();
        if (j?.ok) { setData(j); setError(''); setActive(-1); }
        else { setData(null); setError(j?.message || 'Search is unavailable right now.'); }
      } catch (e) {
        if (e?.name !== 'AbortError') { setData(null); setError('Could not reach the server.'); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  const results = data?.results || [];
  const term = q.trim();
  const allHref = `/search?q=${encodeURIComponent(term)}`;
  // The "view all" row is the last keyboard stop.
  const last = results.length;

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (term.length < 2) return;
      e.preventDefault();
      setActive(i => {
        const n = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return n > last ? 0 : n < 0 ? last : n;
      });
      return;
    }
    if (e.key === 'Enter' && term.length >= 2) {
      e.preventDefault();
      if (active >= 0 && active < results.length) {
        recordOpen(results[active].type);
        window.location.assign(results[active].url);
      } else {
        window.location.assign(allHref);
      }
    }
  }

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`tnr-sr-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!mounted) return null;

  const fade = reduce ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="backdrop" className="fixed inset-0 z-[1000] bg-[#052A1E]/55 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search TNR"
            initial={reduce ? false : { opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }} transition={fade}
            /* Full screen on a phone (100dvh, so the on-screen keyboard does
               not push the field out of view); a floating palette from sm up. */
            className="mx-auto flex h-[100dvh] w-full flex-col bg-white shadow-2xl
              sm:mt-[9vh] sm:h-auto sm:max-h-[76vh] sm:max-w-2xl sm:rounded-2xl sm:ring-1 sm:ring-black/5">

            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 sm:px-4">
              <Search size={20} className="shrink-0 text-[#0B6B4F]" aria-hidden="true" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
                type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off"
                spellCheck={false} maxLength={80}
                role="combobox" aria-expanded={results.length > 0} aria-controls="tnr-search-list"
                aria-activedescendant={active >= 0 ? `tnr-sr-${active}` : undefined}
                placeholder="Search members, scholarships, villages, news…"
                /* 16px on phones: anything smaller makes iOS zoom the page on focus. */
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 outline-none
                  placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden" />
              {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-[#0B6B4F]" aria-hidden="true" />}
              <button type="button" onClick={onClose} aria-label="Close search"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" aria-live="polite">
              {term.length < 2 && (
                <div className="px-3 py-8 text-center text-[13.5px] text-gray-500">
                  <p>Find TNR members, leadership, scholarships, news, villages, Union Councils and statistics.</p>
                  <p className="mt-2 text-[12.5px] text-gray-400">You can type in English, Roman Urdu or اردو.</p>
                </div>
              )}

              {error && <p className="px-3 py-6 text-center text-[13.5px] text-red-700">{error}</p>}

              {term.length >= 2 && !error && data && results.length === 0 && !loading && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[14px] font-semibold text-gray-800">No results for “{term}”</p>
                  <p className="mt-1 text-[12.5px] text-gray-500">Check the spelling, or try a shorter word.</p>
                </div>
              )}

              {term.length >= 2 && !data && loading && (
                <div className="space-y-2 p-1" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}
                </div>
              )}

              {results.length > 0 && (
                <div id="tnr-search-list" role="listbox" aria-label="Suggestions">
                  {data.corrected && (
                    <p className="px-3 pb-1 pt-0.5 text-[12px] text-gray-500">No exact match — showing the closest results.</p>
                  )}
                  {results.map((r, i) => (
                    <ResultRow key={r.id} id={`tnr-sr-${i}`} result={r} query={term}
                      active={i === active} onHover={() => setActive(i)} />
                  ))}
                  <a id={`tnr-sr-${last}`} href={allHref} role="option" aria-selected={active === last}
                    onMouseEnter={() => setActive(last)}
                    className={`mt-1 flex items-center justify-between rounded-xl px-3 py-3 text-[14px] font-semibold text-[#0B6B4F] ${
                      active === last ? 'bg-[#0B6B4F]/10' : 'hover:bg-gray-50'}`}>
                    <span>View all {data.total} result{data.total === 1 ? '' : 's'}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>

            <div className="hidden items-center gap-4 border-t border-gray-100 px-4 py-2 text-[11.5px] text-gray-400 sm:flex">
              <span><kbd className="rounded border border-gray-200 px-1">↑</kbd> <kbd className="rounded border border-gray-200 px-1">↓</kbd> to move</span>
              <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> to open</span>
              <span><kbd className="rounded border border-gray-200 px-1">Esc</kbd> to close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
