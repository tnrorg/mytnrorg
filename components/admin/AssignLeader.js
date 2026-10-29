'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from './adminApi';
import { Card } from './ui';

/** Assign an already-approved member to a leadership body.
 *  Preferred over "Add Profile": the person's name, photo, education and
 *  profession are already on record, so seeding from the member row avoids
 *  retyping and keeps one source of truth. */
export default function AssignLeader({ body, bodyLabel, onDone, toast }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [picked, setPicked] = useState(null);
  const [designation, setDesignation] = useState('');
  /* The university an ambassador represents.
   *
   * A field of its own rather than reusing `designation`. Designation is the
   * POST someone holds — President, General Secretary — and the first
   * ambassador assigned ended up with the designation "University
   * Ambassadors", which is the name of the body and tells a visitor nothing.
   * The campus is a different fact and belongs in `affiliation`, which the
   * edit form already labels "university, employer, organisation". */
  const [affiliation, setAffiliation] = useState('');
  const [busy, setBusy] = useState(false);

  const isAmbassador = body === 'ambassador';

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      aGet('/api/admin/leadership/assign?q=' + encodeURIComponent(q.trim()))
        .then(r => setHits(r?.ok ? r.members : []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function assign() {
    if (!picked) return;
    setBusy(true);
    const r = await aPost('/api/admin/leadership/assign', {
      identifier: picked.membership_id, body,
      /* An ambassador's designation is always the same thing, so it is filled
       * in rather than asked for — what varies is the campus. */
      designation: isAmbassador ? (designation || 'University Ambassador') : designation,
      affiliation: isAmbassador ? affiliation : undefined,
    });
    setBusy(false);
    if (!r?.ok) return toast(r?.message || 'Could not assign', 'err');
    toast(r.moved ? `Moved to ${bodyLabel}` : `${picked.full_name} added to ${bodyLabel}`);
    setQ(''); setHits([]); setPicked(null); setDesignation(''); setAffiliation('');
    onDone();
  }

  const input = 'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-tnr-cream outline-none focus:border-tnr-gold';

  return (
    <Card>
      <h3 className="font-black text-tnr-cream mb-1">Assign an existing member</h3>
      <p className="text-xs text-tnr-cream/50 mb-3">
        Search by Membership ID, email or name. Their profile is created from the details
        already on their member record, and they can complete the rest from their own portal.
      </p>

      <input className={input} value={q} onChange={e => { setQ(e.target.value); setPicked(null); }}
        placeholder="e.g. TNR-0001, name@example.com, or a name" />

      {!!hits.length && !picked && (
        <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
          {hits.map(m => (
            <li key={m.id}>
              <button onClick={() => { setPicked(m); setQ(m.full_name); }}
                className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/5 transition">
                <div className="text-sm text-tnr-cream font-semibold">{m.full_name}</div>
                <div className="text-[11px] text-tnr-cream/50">
                  {m.membership_id} · {m.email}
                  {m.role && m.role !== 'general' && <> · already {m.role}</>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(3,26,18,.4)' }}>
            <div className="text-sm font-bold text-tnr-cream">{picked.full_name}</div>
            <div className="text-[11px] text-tnr-cream/55">
              {picked.membership_id} · {picked.email}
              {picked.current_position && <> · {picked.current_position}</>}
            </div>
            {picked.leadership_profile_id && (
              <div className="text-[11px] text-amber-300 mt-1">
                Already has a leadership profile — assigning will move it to {bodyLabel}.
              </div>
            )}
          </div>
          {/* The university comes FIRST on the ambassador tab, because it is
              the one thing that actually has to be filled in — the roster is
              meaningless without it, and it is what the public card shows
              under the person's name. */}
          {isAmbassador && (
            <input className={input} value={affiliation} autoFocus
              onChange={e => setAffiliation(e.target.value)}
              placeholder="University, e.g. COMSATS University Islamabad" />
          )}
          <input className={input} value={designation} onChange={e => setDesignation(e.target.value)}
            placeholder={body === 'executive' ? 'Designation, e.g. President'
              : isAmbassador ? 'Title (optional) — defaults to “University Ambassador”'
                : 'Designation (optional)'} />
          <div className="flex gap-2">
            <button className="btn-green" onClick={assign} disabled={busy}>
              {busy ? 'Assigning…' : `Add to ${bodyLabel}`}
            </button>
            <button className="btn-ghost" onClick={() => { setPicked(null); setQ(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}
