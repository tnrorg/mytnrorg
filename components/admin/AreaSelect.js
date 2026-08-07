'use client';
import { useEffect, useState } from 'react';
import { Field } from './ui';

/* Dependent Union Council → Village dropdowns, fed by the admin-managed Areas
 * list (Admin → Membership → Areas) — the same source the public application
 * form uses, so a project and a member can never be filed under two different
 * spellings of the same village.
 */

/** Fetches the managed area list once. Shared by anything needing the dropdowns. */
export function useAreas() {
  const [councils, setCouncils] = useState(null);   // null = still loading
  useEffect(() => {
    let off = false;
    fetch('/api/public/areas', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setCouncils(j?.ok ? (j.councils || []) : []); })
      .catch(() => { if (!off) setCouncils([]); });
    return () => { off = true; };
  }, []);
  return councils;
}

/**
 * Two selects. `onChange(patch)` receives `{ union_council }` or
 * `{ union_council, village }` — changing the council clears the village,
 * because a village only makes sense inside its own council.
 *
 * A value that is no longer on the managed list (renamed or removed since the
 * record was created) is kept as an extra option and flagged, rather than
 * silently disappearing and blanking the field on the next save.
 */
export default function AreaSelect({ council, village, onChange, required }) {
  const councils = useAreas();

  if (councils === null) {
    return <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Union Council"><div className="input opacity-50">Loading…</div></Field>
      <Field label="Village / Area"><div className="input opacity-50">Loading…</div></Field>
    </div>;
  }

  // No areas configured: fall back to free text rather than an empty dropdown
  // the admin cannot get past.
  if (!councils.length) {
    return <>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Union Council">
          <input className="input" value={council || ''} onChange={e => onChange({ union_council: e.target.value })} />
        </Field>
        <Field label="Village / Area">
          <input className="input" value={village || ''} onChange={e => onChange({ village: e.target.value })} />
        </Field>
      </div>
      <p className="-mt-1 mb-3 text-[11px] text-amber-300">
        No areas are set up yet. Add them under Membership → Areas to get dropdowns here.
      </p>
    </>;
  }

  const names = councils.map(c => c.name);
  const villages = councils.find(c => c.name === council)?.villages || [];
  const strayCouncil = council && !names.includes(council);
  const strayVillage = village && !villages.includes(village);

  return <>
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label={`Union Council${required ? '' : ''}`}>
        <select className="input" value={council || ''}
          onChange={e => onChange({ union_council: e.target.value, village: '' })}>
          <option value="">— Select —</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
          {strayCouncil && <option value={council}>{council} (not on the list)</option>}
        </select>
      </Field>

      <Field label="Village / Area">
        <select className="input" value={village || ''} disabled={!council}
          onChange={e => onChange({ village: e.target.value })}>
          <option value="">{council ? '— Select —' : 'Choose a Union Council first'}</option>
          {villages.map(n => <option key={n} value={n}>{n}</option>)}
          {strayVillage && <option value={village}>{village} (not on the list)</option>}
        </select>
      </Field>
    </div>

    {(strayCouncil || strayVillage) && (
      <p className="-mt-1 mb-3 text-[11px] text-amber-300">
        {strayVillage ? `“${village}”` : `“${council}”`} is not on the managed Areas
        list — it may have been renamed. Pick the current name, or add it under
        Membership → Areas.
      </p>
    )}
  </>;
}
