'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { orderedCountries, findByIso, splitPhone, DEFAULT_ISO } from '@/lib/membership/dialCodes';

/**
 * Country dial code + local number, stored as one E.164 string (+923001234567).
 *
 * A single free-text field produced "0300…", "+92 300…", "0092300…" and
 * "300…" for the same person, which then had to be guessed at on the server.
 * Picking the country explicitly removes the ambiguity at the source.
 *
 * @param {string} value    full number, e.g. "+923001234567"
 * @param {(v: string) => void} onChange
 */
export default function PhoneInput({ value, onChange, onBlur, bad, id }) {
  const { top, rest } = useMemo(() => orderedCountries(), []);
  const parsed = useMemo(() => splitPhone(value), [value]);

  const [iso, setIso] = useState(parsed.iso || DEFAULT_ISO);
  const [local, setLocal] = useState(parsed.local || '');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef(null);

  // Re-sync when the parent replaces the value wholesale — a restored draft,
  // or the form being reset after submission.
  useEffect(() => {
    const p = splitPhone(value);
    setIso(p.iso || DEFAULT_ISO);
    setLocal(p.local || '');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const country = findByIso(iso) || findByIso(DEFAULT_ISO);

  function emit(nextIso, nextLocal) {
    const c = findByIso(nextIso) || findByIso(DEFAULT_ISO);
    // A leading zero is a domestic trunk prefix — "0300" is "+92 300", not
    // "+92 0300". Dropping it here means the stored number is always dialable.
    const digits = String(nextLocal || '').replace(/\D/g, '').replace(/^0+/, '');
    onChange(digits ? `${c[2]}${digits}` : '');
  }

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = [...top, ...rest];
    if (!needle) return null;
    return all.filter(c =>
      c[0].toLowerCase().includes(needle) ||
      c[2].includes(needle) ||
      c[1].toLowerCase() === needle
    ).slice(0, 40);
  }, [q, top, rest]);

  const Row = ({ c }) => (
    <li>
      <button type="button"
        onPointerDown={(e) => { e.preventDefault(); setIso(c[1]); emit(c[1], local); setOpen(false); setQ(''); }}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-emerald-50
          ${c[1] === iso ? 'bg-emerald-50/70 font-semibold' : ''}`}>
        <span className="text-base leading-none">{c[3]}</span>
        <span className="min-w-0 flex-1 truncate text-gray-800">{c[0]}</span>
        <span className="font-mono text-xs text-gray-500">{c[2]}</span>
      </button>
    </li>
  );

  const border = bad ? 'border-red-300' : 'border-gray-200';

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-stretch overflow-hidden rounded-xl border bg-white/85 ${border}
        focus-within:border-[#0B6B4F] focus-within:ring-2 focus-within:ring-[#0B6B4F]/15`}>

        <button type="button" onClick={() => setOpen(o => !o)}
          aria-label="Select country code" aria-expanded={open}
          className="flex shrink-0 items-center gap-1.5 border-r border-gray-200 px-3 hover:bg-gray-50">
          <span className="text-base leading-none">{country[3]}</span>
          <span className="font-mono text-sm text-gray-700">{country[2]}</span>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true"
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={local}
          placeholder="3XX XXXXXXX"
          onChange={(e) => { const v = e.target.value; setLocal(v); emit(iso, v); }}
          onBlur={onBlur}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[16px] sm:text-sm outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search country or code"
              className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#0B6B4F]" />
          </div>
          <ul className="max-h-60 overflow-auto overscroll-contain">
            {matches ? (
              matches.length
                ? matches.map(c => <Row key={c[1]} c={c} />)
                : <li className="px-3 py-3 text-sm text-gray-400">No match</li>
            ) : (
              <>
                {top.map(c => <Row key={c[1]} c={c} />)}
                <li className="my-1 border-t border-gray-100" aria-hidden="true" />
                {rest.map(c => <Row key={c[1]} c={c} />)}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
