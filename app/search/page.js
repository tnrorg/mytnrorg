'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SearchX } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { ResultCard } from '@/components/search/SearchResult';
import { TABS, TAB_KEYS } from '@/lib/search/types';

/* ── /search?q=…&tab=… ───────────────────────────────────────────────────────
 *
 * The address bar is the state: the query and the tab live in the URL, so a
 * results page can be bookmarked, shared and reached with the Back button.
 * Results come from /api/public/search — the same public index the navbar
 * overlay uses — one page at a time.
 */

function Skeletons() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Results() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get('q') || '').trim().slice(0, 80);
  const tab = TAB_KEYS.includes(params.get('tab')) ? params.get('tab') : 'all';

  const [draft, setDraft] = useState(q);
  const [items, setItems] = useState([]);
  const [info, setInfo] = useState(null);       // { total, counts, corrected }
  const [page, setPage] = useState(1);
  const [state, setState] = useState('idle');   // idle | loading | more | error
  const [error, setError] = useState('');
  const logged = useRef('');                    // the query already counted once
  const ctrlRef = useRef(null);

  useEffect(() => { setDraft(q); }, [q]);

  const load = useCallback(async (pageNo) => {
    ctrlRef.current?.abort();
    if (q.length < 2) { setItems([]); setInfo(null); setState('idle'); return; }
    const ctrl = new AbortController(); ctrlRef.current = ctrl;
    setState(pageNo === 1 ? 'loading' : 'more'); setError('');

    const p = new URLSearchParams({ q, tab, page: String(pageNo) });
    /* Counted as one search per query — not again for each tab or page. */
    if (pageNo === 1 && logged.current !== q) { p.set('final', '1'); logged.current = q; }

    try {
      const r = await fetch(`/api/public/search?${p}`, { signal: ctrl.signal, cache: 'no-store' });
      const j = await r.json();
      if (ctrl.signal.aborted) return;
      if (!j?.ok) { setError(j?.message || 'Search is unavailable right now.'); setState('error'); return; }
      setItems(prev => (pageNo === 1 ? j.results : [...prev, ...j.results]));
      setInfo({ total: j.total, counts: j.counts || {}, corrected: j.corrected });
      setPage(pageNo); setState('idle');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError('Could not reach the server. Check your connection and try again.'); setState('error');
    }
  }, [q, tab]);

  useEffect(() => { load(1); return () => ctrlRef.current?.abort(); }, [load]);

  const go = (nextQ, nextTab) => {
    const p = new URLSearchParams();
    if (nextQ) p.set('q', nextQ);
    if (nextTab && nextTab !== 'all') p.set('tab', nextTab);
    router.push(`/search${p.toString() ? `?${p}` : ''}`);
  };

  const hasMore = info && items.length < info.total;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <h1 className="text-[26px] font-black leading-tight text-[#063D2B] sm:text-[30px]">Search TNR</h1>

      <form role="search" className="mt-4" onSubmit={(e) => { e.preventDefault(); go(draft.trim(), 'all'); }}>
        <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 shadow-sm
          focus-within:border-[#0B6B4F] focus-within:ring-2 focus-within:ring-[#0B6B4F]/20">
          <Search size={20} className="shrink-0 text-[#0B6B4F]" aria-hidden="true" />
          <input value={draft} onChange={e => setDraft(e.target.value)} type="search" maxLength={80}
            enterKeyHint="search" autoComplete="off" aria-label="Search TNR"
            placeholder="Members, scholarships, villages, news…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-gray-400" />
          <button type="submit" className="rounded-xl bg-[#0B6B4F] px-4 py-2 text-[14px] font-semibold text-white
            transition hover:bg-[#095a42]">Search</button>
        </div>
      </form>

      {q.length >= 2 && (
        <nav className="mt-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="Result categories">
          {TABS.map(([key, label]) => {
            const n = info?.counts?.[key] || 0;
            /* A category with nothing in it is hidden rather than shown as a
               dead tab — except the one being viewed. */
            if (key !== 'all' && key !== tab && info && !n) return null;
            return (
              <button key={key} type="button" onClick={() => go(q, key)} aria-current={tab === key ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                  tab === key ? 'bg-[#063D2B] text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                {label}{info ? <span className={tab === key ? 'ml-1.5 text-white/70' : 'ml-1.5 text-gray-400'}>{n}</span> : null}
              </button>
            );
          })}
        </nav>
      )}

      <div className="mt-5" aria-live="polite" aria-busy={state === 'loading'}>
        {q.length < 2 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-[15px] font-semibold text-gray-800">What are you looking for?</p>
            <p className="mt-1 text-[13.5px] text-gray-500">
              Try a member&apos;s name, a village, a Union Council, “scholarship”, or a profession such as “engineer”.
              English, Roman Urdu and اردو all work.
            </p>
          </div>
        )}

        {state === 'loading' && <Skeletons />}

        {state === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[14px] text-red-800">
            {error} <button type="button" className="ml-1 font-semibold underline" onClick={() => load(1)}>Try again</button>
          </div>
        )}

        {state !== 'loading' && state !== 'error' && q.length >= 2 && info && items.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <SearchX size={34} className="mx-auto text-gray-300" aria-hidden="true" />
            <p className="mt-3 text-[16px] font-bold text-[#063D2B]">No results for “{q}”</p>
            <p className="mx-auto mt-1 max-w-md text-[13.5px] text-gray-500">
              {tab !== 'all' && info.counts.all
                ? 'Nothing in this category — there are results under All results.'
                : 'Check the spelling, try a shorter word, or search for a village or Union Council name.'}
            </p>
            {tab !== 'all' && info.counts.all > 0 && (
              <button type="button" onClick={() => go(q, 'all')}
                className="mt-4 rounded-xl bg-[#0B6B4F] px-4 py-2 text-[13.5px] font-semibold text-white">Show all results</button>
            )}
          </div>
        )}

        {state !== 'loading' && items.length > 0 && (
          <>
            <p className="mb-3 text-[13px] text-gray-500">
              {info.total} result{info.total === 1 ? '' : 's'} for <strong className="text-gray-800">“{q}”</strong>
              {info.corrected && ' — no exact match, so these are the closest'}
            </p>
            <ul className="space-y-3">
              {items.map(r => <li key={r.id}><ResultCard result={r} query={q} /></li>)}
            </ul>
            {hasMore && (
              <div className="mt-5 text-center">
                <button type="button" disabled={state === 'more'} onClick={() => load(page + 1)}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-[14px] font-semibold text-gray-800
                    transition hover:bg-gray-50 disabled:opacity-50">
                  {state === 'more' ? 'Loading…' : `Show more (${info.total - items.length} left)`}
                </button>
              </div>
            )}
            <p className="mt-6 text-[12px] leading-relaxed text-gray-400">
              Search covers what is published on this website. Member counts are TNR&apos;s own membership
              figures, not the population of Roundu, and groups of fewer than five are not shown exactly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#F7F8F6]">
      <SiteNav />
      {/* useSearchParams needs a Suspense boundary to build. */}
      <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-10"><Skeletons /></div>}>
        <Results />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
