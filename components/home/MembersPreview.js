'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { Reveal, SectionHeading } from '@/components/ui';
import CountUp from '@/components/ui/CountUp';
import { COLORS, FONT, CHART_GREENS } from '@/lib/design/tokens';

// Members analytics preview. Every figure comes from the membership database
// via /api/public/community-stats — the panels this replaced showed invented
// numbers ("10,248+ Total Members", "25 countries") and linked to pages that
// did not exist.
export default function MembersPreview() {
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/public/community-stats', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => (j?.ok ? setD(j) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  // Nothing to preview until there are approved members — better an absent
  // section than an empty-looking one.
  if (failed || (d && !d.community?.members)) return null;

  const top = d?.top5 || [];
  const max = top[0]?.members || 1;

  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <Reveal>
        <div className="tnr-glass tnr-sheen rounded-tnr-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Our Members" title="Membership Across Roundu"
              lead="Approved members, grouped by the village or area they call home." />
            <a href="/members"
              className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold text-white
                transition-transform duration-micro hover:-translate-y-[2px]"
              style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
              View All Members
              <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true"
                className="transition-transform duration-micro group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="mt-8 grid lg:grid-cols-[minmax(0,300px),minmax(0,1fr)] gap-8">
            <div className="rounded-tnr-lg p-6 text-center"
              style={{ background: 'rgba(23,107,73,.06)' }}>
              <div className="text-5xl font-extrabold leading-none" style={{ color: COLORS.green900 }}>
                {d ? <CountUp value={d.community.members} /> : <span className="opacity-30">—</span>}
              </div>
              <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>
                Active Members
              </div>
              <div className="mx-auto my-4 h-px w-12" style={{ background: COLORS.gold500 }} />
              <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: COLORS.green700 }}>
                <MapPin size={14} strokeWidth={2.2} aria-hidden="true" />
                {d ? `${d.community.areas} villages / areas` : '—'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] mb-4" style={{ color: COLORS.green700 }}>
                Top Areas by Membership
              </div>
              {!d && <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) =>
                  <div key={i} className="h-8 rounded bg-gray-50 animate-pulse" />)}
              </div>}
              <ol className="space-y-3">
                {top.map((r, i) => (
                  <li key={r.area}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-semibold truncate" style={{ color: COLORS.charcoal }}>
                        <span className="tabular-nums mr-2" style={{ color: COLORS.muted }}>{i + 1}.</span>{r.area}
                      </span>
                      <span className="font-extrabold tabular-nums shrink-0" style={{ color: COLORS.green900 }}>
                        {r.members}
                      </span>
                    </div>
                    {/* Bar doubles as the visual, so no extra chart library here. */}
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
                      <div className="h-full rounded-full transition-[width] duration-reveal"
                        style={{ width: `${(r.members / max) * 100}%`, background: CHART_GREENS[i % CHART_GREENS.length] }} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
