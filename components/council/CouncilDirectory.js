'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';
import { academicTitle } from '@/lib/membership/options';
import LeadershipCard from '@/components/leadership/LeadershipCard';

/* The card itself now lives in components/leadership/LeadershipCard.js, so the
 * Advisory Council, the Central Executive Committee and both ambassador
 * rosters render exactly the same object. It used to be a local function here;
 * the executive roster matching it meant either a second copy of a design with
 * a hover outline, a gold sweep and a measured mobile type scale — or one
 * component. This is the one component.
 *
 * What stays in this file is what is particular to the council roster: the
 * search box, the three filters, and the mapping from a council record to the
 * card's props. */
function Card({ m, i, bodyLabel }) {
  /* "Sartaj  Ahmed, PhD" is typed with two spaces in the record. Harmless in
     a two-line clamp, but on one truncated line it spends a character of a
     very tight budget on nothing. Collapsed for display only — the stored
     value is untouched. */
  const name = String(m.name || '').replace(/\s+/g, ' ').trim();

  /* The office outranks the day job on a leadership card.
   *
   * "Convener" tells a visitor what this person does FOR TNR, which is the
   * question the roster exists to answer; "Senior Research Officer" is who
   * they are elsewhere. Both are on the profile page — only one fits here,
   * and when someone holds an office it is that one. */
  const role = m.designation || m.profession || academicTitle(m.qualification, m.field);

  return (
    <LeadershipCard
      index={i} slug={m.slug} bodyLabel={bodyLabel}
      name={name} role={role}
      photoUrl={m.photo_url} photoPosition={m.photo_position}
      meta={[m.organisation || m.affiliation, m.country]}
      href={`/council/${m.slug}`}
    />
  );
}

/** Council roster with search and filters. `limit` renders a homepage preview. */
/**
 * Council roster with search and filters. `limit` renders a homepage preview.
 *
 * `bodyLabel` is the chip stamped on every card. It defaults to Advisory
 * Council because that is the only body this endpoint serves today — but it
 * is a prop, not a hardcoded string, so pointing the component at another
 * roster later does not mean every card quietly mislabelling itself.
 */
export default function CouncilDirectory({
  limit, showFilters = true, bodyLabel = 'Advisory Council',
}) {
  const [d, setD] = useState(null);
  const [f, setF] = useState({ q: '', country: '', profession: '', expertise: '' });
  const [openFilters, setOpenFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/public/council?' + new URLSearchParams(f), { cache: 'no-store' })
        .then(r => r.json()).then(j => j?.ok && setD(j)).catch(() => setD({ members: [], filters: {} }));
    }, 200);
    return () => clearTimeout(t);
  }, [f]);

  const members = useMemo(
    () => (limit ? (d?.members || []).slice(0, limit) : d?.members || []), [d, limit]);
  const active = Object.entries(f).filter(([k, v]) => k !== 'q' && v).length;
  const sel = 'rounded-tnr border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#176B49] bg-white';

  if (!d) return (
    /* The skeleton has to stand at roughly the height the real card settles
       at — a 4:5 portrait, 10px of frame either side, the status line and the
       button — or the page jumps when the roster lands, which is the layout
       shift this placeholder exists to prevent in the first place. */
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
      {/* Two heights, because the card is a proportion of its column and the
          column halves on a phone: a 146px-wide 4:5 portrait plus the status
          line and the button settles near 16rem, not the 25rem a desktop card
          reaches. A skeleton that guesses the wrong height reintroduces
          exactly the jump it is here to prevent. */}
      {Array.from({ length: limit || 8 })
        .map((_, i) => <Skeleton key={i} height="h-[16rem] sm:h-[25rem]" />)}
    </div>
  );

  return (
    <div style={FONT}>
      {showFilters && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} strokeWidth={2.2} aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
              <input value={f.q} onChange={e => setF(s => ({ ...s, q: e.target.value }))}
                aria-label="Search council members"
                placeholder="Search by name, profession, expertise, organisation or country"
                className={sel + ' w-full pl-10'} />
            </div>
            <button onClick={() => setOpenFilters(o => !o)}
              className="sm:hidden inline-flex items-center gap-1.5 rounded-tnr px-4 text-sm font-bold text-white shrink-0"
              style={{ background: COLORS.green700 }}>
              <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />
              {active > 0 && <span>{active}</span>}
            </button>
          </div>

          <div className={`${openFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2`}>
            {[['country', 'All Countries', 'countries'],
              ['profession', 'All Professions', 'professions'],
              ['expertise', 'All Expertise', 'expertise']].map(([key, label, list]) => (
              <select key={key} value={f[key]} aria-label={label} className={sel}
                onChange={e => setF(s => ({ ...s, [key]: e.target.value }))}>
                <option value="">{label}</option>
                {(d.filters?.[list] || []).map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            ))}
          </div>

          {(active > 0 || f.q) && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[12px]" style={{ color: COLORS.muted }}>
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
              <button onClick={() => setF({ q: '', country: '', profession: '', expertise: '' })}
                className="text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>Clear</button>
            </div>
          )}
        </>
      )}

      {members.length === 0 ? (
        <EmptyState className="mt-6" icon="🎓"
          title={f.q || active ? 'No members match your search' : 'Council profiles coming soon'}
          message={f.q || active
            ? 'Try a different name, profession or country.'
            : 'Advisory Council profiles will appear here once published.'} />
      ) : (
        <div className={`${showFilters ? 'mt-6' : ''} grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5`}>
          {members.map((m, i) => <Card key={m.slug} m={m} i={i} bodyLabel={bodyLabel} />)}
        </div>
      )}
    </div>
  );
}
