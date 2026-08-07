'use client';
import { useEffect, useState } from 'react';
import { Landmark, MapPin, Globe2, ChevronDown } from 'lucide-react';
import { statCard } from '@/components/stats/StatsShell';
import LocationMembersDrawer from '@/components/stats/LocationMembersDrawer';
import CountryFlag from '@/components/stats/CountryFlag';
import { COLORS } from '@/lib/design/tokens';

/* Where TNR's approved members are — Roundu, Pakistan, and the rest of the
 * world. Everything is read from the membership database; there is not a
 * single hardcoded place name or count in this file.
 *
 * Uses the statistics page's existing card, colours and type, so it sits
 * alongside the other sections rather than looking like a separate feature.
 */
export default function MembershipGeography() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  // The location a visitor has opened. Null until something is clicked — the
  // member list is only fetched then, never on page load.
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/membership-geography', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) (j?.ok ? setD(j) : setErr(j?.message || '')); })
      .catch(() => { if (!off) setErr('Membership figures are unavailable right now.'); })
      .finally(() => {});
    return () => { off = true; };
  }, []);

  if (err) return null;                 // the page already has its own error state
  if (!d || d.total === 0) return null; // nothing approved yet — show nothing

  return (
    <>
      <Section
        icon={Landmark}
        title="Membership Across Roundu"
        note="Approved members grouped by their permanent Union Council and village."
        stats={[
          [d.roundu.members, 'Members'],
          [d.roundu.totalCouncils, 'Union Councils'],
          [d.roundu.totalVillages, 'Villages'],
        ]}
        groups={d.roundu.councils}
        childLabel="villages"
        emptyText="No permanent addresses recorded yet."
        onOpen={setDrill}
        parentScope="union_council"
        childScope="village"
      />

      <Section
        icon={MapPin}
        title="Membership Across Pakistan"
        note="Approved members currently living in Pakistan, by province and city."
        stats={[
          [d.pakistan.members, 'Members'],
          [d.pakistan.totalProvinces, 'Provinces'],
          [d.pakistan.totalCities, 'Cities'],
        ]}
        groups={d.pakistan.provinces}
        childLabel="cities"
        emptyText="No members have recorded a current address in Pakistan yet."
        onOpen={setDrill}
        parentScope="province"
        childScope="city"
      />

      {/* Countries, with the flag derived from the stored ISO code. */}
      <div className={statCard}>
        <Head icon={Globe2} title="Membership Across the Globe"
          note="Approved members living outside Pakistan." />
        <Numbers stats={[
          [d.global.members, 'Members'],
          [d.global.totalCountries, 'Countries'],
        ]} />
        {d.global.countries.length === 0 ? (
          <p className="mt-4 text-[13px]" style={{ color: COLORS.muted }}>
            No members have recorded a current address outside Pakistan yet.
          </p>
        ) : (
          <ul className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {d.global.countries.map(c => (
              <li key={c.code || c.name}>
                <button
                  onClick={() => setDrill({
                    scope: 'country', value: c.code || c.name,
                    title: c.name, flagCode: c.code,
                  })}
                  className="w-full flex items-center gap-3 rounded-tnr border px-3.5 py-2.5 text-left
                    transition-colors hover:bg-tnr-neutral"
                  style={{ borderColor: COLORS.neutral }}>
                  <CountryFlag code={c.code} size={16} />
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold truncate"
                    style={{ color: COLORS.charcoal }}>{c.name}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums"
                    style={{ color: COLORS.green900 }}>
                    {c.count}
                    <span className="ml-1 font-medium" style={{ color: COLORS.muted }}>
                      {c.count === 1 ? 'member' : 'members'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LocationMembersDrawer
        open={!!drill} onClose={() => setDrill(null)}
        scope={drill?.scope} value={drill?.value} parent={drill?.parent}
        title={drill?.title} subtitle={drill?.subtitle} flagCode={drill?.flagCode} />

      {/* Stated, not hidden. Members approved before the address questions
          existed have no current address, so the three sections do not add up
          to the total — leaving that unexplained invites the figures being
          called wrong. */}
      {d.withoutCurrentAddress > 0 && (
        <p className="text-[12px] leading-relaxed" style={{ color: COLORS.muted }}>
          {d.withoutCurrentAddress} approved member{d.withoutCurrentAddress === 1 ? ' has' : 's have'} not
          recorded a current address yet, so {d.withoutCurrentAddress === 1 ? 'it is' : 'they are'} counted
          in the Roundu totals but not in the Pakistan or global figures.
        </p>
      )}
    </>
  );
}

const Head = ({ icon: Icon, title, note }) => (
  <>
    <div className="flex items-center gap-2.5">
      <Icon size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
      <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>{title}</h2>
    </div>
    <p className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>{note}</p>
  </>
);

const Numbers = ({ stats }) => (
  <div className="mt-4 grid grid-cols-3 gap-3">
    {stats.map(([v, l]) => (
      <div key={l} className="rounded-tnr border p-3 text-center" style={{ borderColor: COLORS.neutral }}>
        <div className="text-xl font-extrabold tabular-nums" style={{ color: COLORS.green900 }}>
          {Number(v || 0).toLocaleString()}
        </div>
        <div className="text-[11px]" style={{ color: COLORS.muted }}>{l}</div>
      </div>
    ))}
  </div>
);

/* One parent → children section. Parents collapse, because a district with
   twenty union councils each holding a dozen villages is unreadable fully
   expanded — and the counts are what most visitors came for. */
function Section({ icon, title, note, stats, groups, childLabel, emptyText,
  onOpen, parentScope, childScope }) {
  const [open, setOpen] = useState(null);
  return (
    <div className={statCard}>
      <Head icon={icon} title={title} note={note} />
      <Numbers stats={stats} />

      {groups.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: COLORS.muted }}>{emptyText}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {groups.map(g => {
            const isOpen = open === g.name;
            return (
              <li key={g.name} className="rounded-tnr border overflow-hidden"
                style={{ borderColor: COLORS.neutral }}>
                <div className="flex items-stretch">
                  {/* The NAME opens the member list; the rest of the row
                      expands the children. Two jobs, two targets — one row
                      doing both would make one of them undiscoverable. */}
                  <button onClick={() => onOpen?.({ scope: parentScope, value: g.name, title: g.name })}
                    className="px-4 py-3 text-left min-w-0 flex-1 transition-colors hover:bg-tnr-neutral">
                    <span className="block text-[14px] font-bold truncate underline decoration-transparent
                      hover:decoration-inherit underline-offset-2"
                      style={{ color: COLORS.green900 }}>{g.name}</span>
                  </button>
                <button onClick={() => setOpen(isOpen ? null : g.name)}
                  aria-expanded={isOpen}
                  aria-label={`Show ${childLabel} in ${g.name}`}
                  className="flex items-center gap-3 pr-4 py-3 transition-colors hover:bg-tnr-neutral">
                  {!!g.children.length && (
                    <span className="shrink-0 text-[11.5px]" style={{ color: COLORS.muted }}>
                      {g.children.length} {childLabel}
                    </span>
                  )}
                  <span className="shrink-0 text-[13px] font-bold tabular-nums"
                    style={{ color: COLORS.green900 }}>{g.count}</span>
                  {!!g.children.length && (
                    <ChevronDown size={15} aria-hidden="true"
                      className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      style={{ color: COLORS.muted }} />
                  )}
                </button>
                </div>

                {isOpen && !!g.children.length && (
                  <ul className="px-4 pb-3 pt-1 grid sm:grid-cols-2 gap-x-6">
                    {g.children.map(c => (
                      <li key={c.name}>
                        <button
                          onClick={() => onOpen?.({
                            scope: childScope, value: c.name, parent: g.name,
                            title: c.name, subtitle: g.name,
                          })}
                          className="w-full flex items-baseline justify-between gap-3 py-1.5 border-b text-[13px]
                            text-left transition-colors hover:text-[#176B49]"
                          style={{ borderColor: COLORS.neutral }}>
                          <span className="truncate" style={{ color: COLORS.charcoal }}>{c.name}</span>
                          <span className="shrink-0 tabular-nums font-semibold"
                            style={{ color: COLORS.green900 }}>{c.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
