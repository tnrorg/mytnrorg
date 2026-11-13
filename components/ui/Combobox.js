'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable single-select that works on mobile.
 *
 * Replaces `<input list> + <datalist>`. Datalist is fine on desktop but iOS
 * Safari never renders it as a dropdown — it pushes the options into the
 * keyboard's QuickType bar instead, so on a phone the field looks like a plain
 * text box with no list at all. Android support is inconsistent too.
 *
 * This renders the filtered list as real DOM, so it behaves identically
 * everywhere, and adds keyboard navigation the native control never had.
 *
 * Props match the previous `Combo` so it can be swapped in directly.
 */
export default function Combobox({
  value = '',
  onChange,
  onBlur,
  options = [],
  placeholder = 'Type to search…',
  className = '',
  bad = false,
  disabled = false,
  id,
  name,
  maxVisible = 60,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [active, setActive] = useState(-1);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listId = `${id || 'cb'}-${autoId}`;

  /* ── The list is rendered into <body>, not beside the input ──────────────
   *
   * It used to be an absolutely-positioned sibling with z-50, and on the
   * membership form it came out UNDERNEATH the Continue button.
   *
   * z-index was never going to fix that. `.tnr-lift` — the shared hover-lift
   * class on that button — sets `will-change: transform`, and that alone
   * creates a stacking context. The button therefore paints as a unit, after
   * the form card that contains this field, so nothing inside the card can
   * rise above it no matter how high its z-index: the panel was only ever
   * competing with its siblings INSIDE the card.
   *
   * A portal takes the list out of the card altogether, so no ancestor's
   * stacking context, `overflow: hidden`, transform or opacity can trap or
   * clip it. Position is copied from the input on open and kept in step on
   * scroll and resize.
   */
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState(null);     // where to paint the list
  useEffect(() => { setMounted(true); }, []);

  const place = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const PANEL = 240;                      // max-h-60
    /* Flip above the field when there is more room up than down — on a phone
       with the keyboard open, "below" is often only a few pixels. */
    const up = below < Math.min(PANEL, 160) && r.top > below;
    setBox({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(120, Math.min(PANEL, (up ? r.top : below) - 12)),
    });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    /* `true` for capture: a scroll inside ANY ancestor must move the panel,
       not just a scroll of the window, or the list detaches from the field. */
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  // Keep the visible text in step when the parent resets the form.
  useEffect(() => { setQuery(value || ''); }, [value]);

  /* Options may be plain strings, or `{ value, keywords }`.
   *
   * The second form exists because people search by abbreviation: nobody types
   * "Karakoram International University", they type "KIU". Keywords are matched
   * but never displayed and never stored — the full name is what goes into the
   * database, so one canonical spelling arrives instead of the half-dozen
   * free-text variants the duplicate-detection engine has to cope with.
   *
   * Strings keep working exactly as before, so the professions list and every
   * other existing caller is untouched. */
  const items = useMemo(() => options.map(o => (
    typeof o === 'string'
      ? { value: o, search: o.toLowerCase() }
      : { value: o.value, search: `${o.value} ${o.keywords || ''}`.toLowerCase() }
  )), [options]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, maxVisible);
    const starts = [];
    const contains = [];
    for (const it of items) {
      /* Ranked on the VISIBLE name first, so typing "uni" puts names beginning
         with it above ones that merely contain it — but a keyword hit still
         qualifies, which is how "KIU" finds Karakoram. */
      const name = it.value.toLowerCase();
      if (name.startsWith(q)) starts.push(it);
      else if (it.search.includes(q)) contains.push(it);
    }
    return [...starts, ...contains].slice(0, maxVisible);
  }, [query, items, maxVisible]);

  // Close when tapping outside. `pointerdown` fires before blur, so the click
  // that picks an option is not swallowed.
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      /* The list is portalled into <body>, so it is NOT inside wrapRef any
         more. Checking only the wrapper would treat every click on an option
         as a click outside and close the list before the choice registered. */
      const inField = wrapRef.current?.contains(e.target);
      const inList = listRef.current?.contains(e.target);
      if (!inField && !inList) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open || active < 0 || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(option) {
    setQuery(option);
    onChange?.(option);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(0); return; }
      setActive(i => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (next < 0) return matches.length - 1;
        if (next >= matches.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' && open && active >= 0 && matches[active]) {
      e.preventDefault();
      choose(matches[active].value);
      return;
    }
    if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  const border = bad ? 'border-red-400' : 'border-gray-300';

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange?.(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a tap on an option registers before the list unmounts.
        onBlur={() => { setTimeout(() => { setOpen(false); onBlur?.(); }, 150); }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border ${border} bg-white px-3 py-2.5 text-[15px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50`}
      />

      {/* Chevron */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Close list' : 'Open list'}
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(o => !o);
          inputRef.current?.focus();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && mounted && box && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{
            position: 'fixed',
            left: box.left, width: box.width,
            top: box.top, bottom: box.bottom,
            maxHeight: box.maxHeight,
            zIndex: 1000,
          }}
          className="overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-gray-400">No match — you can type your own</li>
          )}
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerDown={(e) => { e.preventDefault(); choose(o.value); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2.5 text-[15px] ${
                i === active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-800'
              } ${o.value === value ? 'font-semibold' : ''}`}
            >
              {o.value}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
