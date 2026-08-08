'use client';
import { useEffect, useState } from 'react';
import { MapPin, Globe2, ArrowRight } from 'lucide-react';
import { Reveal, SectionHeading } from '@/components/ui';
import LocationMembersDrawer from '@/components/stats/LocationMembersDrawer';
import CountryFlag from '@/components/stats/CountryFlag';
import { COLORS, FONT } from '@/lib/design/tokens';

/* Membership across Pakistan and the wider world, for the home page.
 *
 * Reads the same endpoint as the Roundu Statistics page, so the two can never
 * disagree. Nothing is hardcoded — every province, city, country and count
 * comes from the membership database, and only approved members are included.
 *
 * A COMPACT view on purpose: the full expandable province → city breakdown
 * lives on the statistics page. Here the job is to show reach at a glance and
 * send anyone who wants detail to that page.
 */
const TOP_PROVINCES = 6;
const TOP_COUNTRIES = 12;

export default function MembershipReach() {
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  // Same drill-down as the statistics page, so the interaction is identical
  // wherever a visitor meets it. Nothing is fetched until a click.
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/membership-geography', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) (j?.ok ? setD(j) : setFailed(true)); })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, []);

  // Nothing to show until members have recorded a current address. An absent
  // section reads better than two empty cards.
  const hasPk = !!d?.pakistan?.members;
  const hasGlobal = !!d?.global?.members;
  if (failed || !d || (!hasPk && !hasGlobal)) return null;

  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Our Reach" title="Membership Beyond Roundu"
            lead="Where our approved members live and work today." />
          <a href="/statistics"
            className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold
              transition-colors duration-micro hover:bg-[rgba(23,107,73,.14)]"
            style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>
            Full Statistics
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
              className="transition-transform duration-micro group-hover:translate-x-0.5" />
          </a>
        </div>
      </Reveal>

      <div className="mt-8 grid lg:grid-cols-2 gap-5">
        {/* ── Pakistan ── */}
        {hasPk && (
          <Reveal delay={0.06}>
            <Card icon={MapPin} title="Across Pakistan"
              stat={d.pakistan.members} statLabel="members"
              note={`${d.pakistan.totalProvinces} province${d.pakistan.totalProvinces === 1 ? '' : 's'} · ${d.pakistan.totalCities} ${d.pakistan.totalCities === 1 ? 'city' : 'cities'}`}>
              <ul className="mt-5 space-y-2.5">
                {d.pakistan.provinces.slice(0, TOP_PROVINCES).map(p => (
                  <li key={p.name}>
                    <button
                      onClick={() => setDrill({ scope: 'province', value: p.name, title: p.name })}
                      className="w-full text-left group">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate group-hover:underline underline-offset-2"
                        style={{ color: COLORS.charcoal }}>{p.name}</span>
                      <span className="shrink-0 tabular-nums font-bold" style={{ color: COLORS.green900 }}>
                        {p.count}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
                      <div className="h-full rounded-full transition-[width] duration-reveal"
                        style={{
                          width: `${(p.count / d.pakistan.provinces[0].count) * 100}%`,
                          background: COLORS.green700,
                        }} />
                    </div>
                    </button>
                  </li>
                ))}
              </ul>
              {d.pakistan.provinces.length > TOP_PROVINCES && (
                <p className="mt-3 text-[11px]" style={{ color: COLORS.muted }}>
                  and {d.pakistan.provinces.length - TOP_PROVINCES} more
                </p>
              )}
            </Card>
          </Reveal>
        )}

        {/* ── Rest of the world ── */}
        {hasGlobal && (
          <Reveal delay={0.12}>
            <Card icon={Globe2} title="Across the Globe"
              stat={d.global.members} statLabel="members"
              note={`${d.global.totalCountries} ${d.global.totalCountries === 1 ? 'country' : 'countries'}`}>
              <ul className="mt-5 grid sm:grid-cols-2 gap-2">
                {d.global.countries.slice(0, TOP_COUNTRIES).map(c => (
                  <li key={c.code || c.name}>
                    <button
                      onClick={() => setDrill({
                        scope: 'country', value: c.code || c.name,
                        title: c.name, flagCode: c.code,
                      })}
                      className="w-full flex items-center gap-2.5 rounded-tnr border px-3 py-2 text-left
                        transition-colors hover:bg-tnr-neutral"
                      style={{ borderColor: COLORS.neutral }}>
                      {/* Flag image from the stored ISO code — emoji flags do
                          not render at all on Windows. */}
                      <CountryFlag code={c.code} size={15} />
                      <span className="min-w-0 flex-1 text-[12.5px] font-semibold truncate"
                        style={{ color: COLORS.charcoal }}>{c.name}</span>
                      <span className="shrink-0 text-[12.5px] font-bold tabular-nums"
                        style={{ color: COLORS.green900 }}>{c.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {d.global.countries.length > TOP_COUNTRIES && (
                <p className="mt-3 text-[11px]" style={{ color: COLORS.muted }}>
                  and {d.global.countries.length - TOP_COUNTRIES} more
                </p>
              )}
            </Card>
          </Reveal>
        )}
      </div>

      <LocationMembersDrawer
        open={!!drill} onClose={() => setDrill(null)}
        scope={drill?.scope} value={drill?.value} parent={drill?.parent}
        title={drill?.title} subtitle={drill?.subtitle} flagCode={drill?.flagCode} />
    </section>
  );
}

/* Same card treatment as the Roundu preview above it, so the two read as one
   section of the page rather than two features. */
function Card({ icon: Icon, title, stat, statLabel, note, children }) {
  return (
    <div className="tnr-glass tnr-sheen tnr-lift h-full rounded-tnr-xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-tnr grid place-items-center shrink-0"
            style={{ background: 'rgba(23,107,73,.09)', color: COLORS.green700 }}>
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-extrabold text-[15px]" style={{ color: COLORS.green900 }}>{title}</h3>
            <p className="text-[11.5px]" style={{ color: COLORS.muted }}>{note}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-extrabold tabular-nums" style={{ color: COLORS.green900 }}>
            {Number(stat || 0).toLocaleString()}
          </div>
          <div className="text-[11px]" style={{ color: COLORS.muted }}>{statLabel}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
