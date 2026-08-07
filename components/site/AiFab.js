'use client';
import { useEffect, useRef, useState } from 'react';

const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const GREEN = '#0B6B4F', DEEP = '#063D2B', GOLD = '#D4A72C', SOFT = '#F3E4B3';

const GREETING = {
  role: 'bot',
  text: 'Assalam-o-Alaikum. I can answer questions about TNR — membership, leadership, ' +
        'governance and our current figures. What would you like to know?',
};

export default function AiFab() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [msgs, setMsgs] = useState([GREETING]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const endRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setHint(true), 1200); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!open || suggestions.length) return;
    fetch('/api/public/ask').then(r => r.json())
      .then(j => j?.ok && setSuggestions(j.suggestions || [])).catch(() => {});
  }, [open, suggestions.length]);

  // Keep the latest reply in view.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  // Escape closes, matching every other dialog on the site.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function ask(text) {
    const question = String(text ?? q).trim();
    if (!question || busy) return;
    setQ('');
    setMsgs(m => [...m, { role: 'you', text: question }]);
    setBusy(true);
    try {
      const r = await fetch('/api/public/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      }).then(x => x.json());
      setMsgs(m => [...m, r?.ok
        ? { role: 'bot', text: r.answer, links: r.links, source: r.source, suggestions: r.suggestions }
        : { role: 'bot', text: r?.message || 'Sorry — something went wrong. Please try again.' }]);
    } catch {
      setMsgs(m => [...m, { role: 'bot', text: 'Network error. Please check your connection and try again.' }]);
    }
    setBusy(false);
  }

  return (
    <>
      {/* ── Panel ── */}
      {open && (
        <div className="fixed inset-x-3 bottom-24 sm:inset-x-auto sm:right-6 sm:w-[380px] z-[61]
          rounded-2xl bg-white shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ ...mont, maxHeight: 'min(70vh, 560px)' }}
          role="dialog" aria-label="Ask TNR AI">

          <div className="flex items-center gap-2 px-4 py-3 text-white shrink-0"
            style={{ background: `linear-gradient(135deg,${GREEN},${DEEP})` }}>
            <span className="font-extrabold text-sm">Ask TNR</span>
            <span className="text-[11px]" style={{ color: SOFT }}>Answers from official TNR information</span>
            <button onClick={() => setOpen(false)} aria-label="Close"
              className="ml-auto text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'you' ? 'flex justify-end' : ''}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                  m.role === 'you' ? 'text-white' : 'text-gray-700'}`}
                  style={m.role === 'you'
                    ? { background: GREEN }
                    : { background: '#F1F4F2' }}>
                  {m.text}

                  {!!(m.links || []).length && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.links.map(([label, href]) => (
                        <a key={href} href={href}
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold bg-white border transition-colors hover:bg-gray-50"
                          style={{ borderColor: 'rgba(11,107,79,.25)', color: GREEN }}>{label} →</a>
                      ))}
                    </div>
                  )}
                  {m.source && (
                    <div className="mt-2 text-[10px] text-gray-400">Source: {m.source}</div>
                  )}
                </div>
              </div>
            ))}

            {busy && <div className="text-[12px] text-gray-400">Looking that up…</div>}

            {/* Suggestions: from the last reply if it had any, otherwise the defaults. */}
            {!busy && (() => {
              const last = msgs[msgs.length - 1];
              const list = last?.suggestions?.length ? last.suggestions
                : msgs.length === 1 ? suggestions : [];
              if (!list.length) return null;
              return (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {list.map(s => (
                    <button key={s} onClick={() => ask(s)}
                      className="rounded-full px-3 py-1.5 text-[11.5px] border transition-colors hover:bg-gray-50"
                      style={{ borderColor: '#E5E7EB', color: DEEP }}>{s}</button>
                  ))}
                </div>
              );
            })()}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(); }}
            className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
            <input value={q} onChange={e => setQ(e.target.value)} maxLength={300}
              aria-label="Your question" placeholder="Ask about TNR…"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-[#15231D]
                outline-none focus:border-[#0B6B4F]" />
            <button type="submit" disabled={!q.trim() || busy}
              className="rounded-xl px-4 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: GREEN }}>Send</button>
          </form>
        </div>
      )}

      {/* ── Button ── */}
      {/* id is how BackToTop knows to sit above this instead of on top of it. */}
      <div id="tnr-ai-fab"
        className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-[60] flex items-center gap-2 flex-row-reverse">
        <button onClick={() => setOpen(o => !o)} aria-label="Ask TNR AI" aria-expanded={open}
          className="relative grid place-items-center w-14 h-14 rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{ background: `linear-gradient(145deg,${GREEN},${DEEP})`, border: `2px solid ${GOLD}` }}>
          {!open && <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: GOLD }} />}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="relative" aria-hidden="true">
            {open
              ? <path d="M6 6l12 12M18 6L6 18" stroke={SOFT} strokeWidth="2.4" strokeLinecap="round" />
              : <>
                  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={SOFT} />
                  <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill={GOLD} />
                </>}
          </svg>
        </button>

        {hint && !open && (
          <button onClick={() => setOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white shadow-xl border border-gray-100 animate-fade-up">
            <span style={mont} className="text-sm font-extrabold text-[#063D2B] whitespace-nowrap">Ask TNR AI</span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">How can I help?</span>
            <span onClick={(e) => { e.stopPropagation(); setHint(false); }} aria-hidden="true"
              className="ml-1 text-gray-300 hover:text-gray-500 text-lg leading-none">×</span>
          </button>
        )}
      </div>
    </>
  );
}
