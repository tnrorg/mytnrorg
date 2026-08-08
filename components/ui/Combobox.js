'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

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

  // Keep the visible text in step when the parent resets the form.
  useEffect(() => { setQuery(value || ''); }, [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxVisible);
    const starts = [];
    const contains = [];
    for (const o of options) {
      const l = String(o).toLowerCase();
      if (l.startsWith(q)) starts.push(o);
      else if (l.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, maxVisible);
  }, [query, options, maxVisible]);

  // Close when tapping outside. `pointerdown` fires before blur, so the click
  // that picks an option is not swallowed.
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
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
      choose(matches[active]);
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

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-gray-400">No match — you can type your own</li>
          )}
          {matches.map((o, i) => (
            <li
              key={o}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={o === value}
              onPointerDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2.5 text-[15px] ${
                i === active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-800'
              } ${o === value ? 'font-semibold' : ''}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
