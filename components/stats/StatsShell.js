'use client';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { EmptyState, Skeleton, CountUp } from '@/components/ui';
import { COLORS, FONT, areaColor } from '@/lib/design/tokens';

/* Shared furniture for the Roundu Statistics pages.
 *
 * Membership, Education, Employment and Projects were otherwise going to
 * repeat the same header, card, bar chart and empty state four times over —
 * which is exactly how four pages drift apart visually.
 */

export const statCard =
  'rounded-tnr-lg bg-white p-6 shadow-tnr-flat border border-[rgba(200,154,43,.35)]';

/** Horizontal bar list. Rows are `{ label, count, percent }`, largest first. */
export function Bar({ rows, colorFrom = 0 }) {
  const max = rows[0]?.count || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate" style={{ color: COLORS.charcoal }}>{r.label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: COLORS.muted }}>
              <b style={{ color: COLORS.green900 }}>{r.count}</b> · {r.percent}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
            <div className="h-full rounded-full transition-[width] duration-reveal"
              style={{ width: `${(r.count / max) * 100}%`, background: areaColor(i + colorFrom) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One headline number with a caption. */
export function BigStat({ value, label, sub }) {
  return (
    <div className={statCard + ' text-center'}>
      <div className="text-4xl sm:text-5xl font-extrabold" style={{ color: COLORS.green900 }}>
        <CountUp value={value} />
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>
        {label}
      </div>
      {sub && <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

/** A titled card wrapping a bar list, with a "top N of M" note. */
export function BreakdownCard({ icon: Icon, title, note, rows, limit = 12, colorFrom = 0 }) {
  if (!rows?.length) return null;
  return (
    <div className={statCard}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />}
        <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>{title}</h2>
      </div>
      {note && <p className="mt-1 mb-4 text-[12px]" style={{ color: COLORS.muted }}>{note}</p>}
      <Bar rows={rows.slice(0, limit)} colorFrom={colorFrom} />
      {rows.length > limit && (
        <p className="mt-3 text-[11px]" style={{ color: COLORS.muted }}>
          Showing the top {limit} of {rows.length}.
        </p>
      )}
    </div>
  );
}

/**
 * Page frame: nav, green header, the standard "what these figures are"
 * caveat, loading skeletons, error and empty states, then the children.
 *
 * `caveat` is deliberately required for the member-derived pages. Presenting
 * self-selected member data as though it described the population of Roundu
 * would be misleading, so every such page has to say what it is.
 */
export default function StatsShell({
  eyebrow = 'Roundu Statistics', title, lead, caveat,
  loading, error, empty, emptyTitle = 'Nothing to show yet', emptyMessage,
  children,
}) {
  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-tnr-snow"
      style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="text-white py-14"
        style={{ background: `linear-gradient(165deg,${COLORS.green950},${COLORS.green800})` }}>
        <div className="max-w-tnr mx-auto px-5">
          <div className="text-[11px] font-bold uppercase tracking-[.2em]" style={{ color: COLORS.gold400 }}>
            {eyebrow}
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">{title}</h1>
          {lead && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.7)' }}>
              {lead}
            </p>
          )}
        </div>
      </header>

      <section className="max-w-tnr mx-auto px-5 py-12 w-full flex-1 space-y-6">
        {caveat && (
          <div className="rounded-tnr-lg px-5 py-4 text-[13px] leading-relaxed"
            style={{ background: 'rgba(200,154,43,.10)', color: '#7A5C10' }}>
            {caveat}
          </div>
        )}

        {error && <EmptyState icon="📊" title="Statistics unavailable" message={error} />}

        {loading && !error && (
          <div className="grid sm:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-56" />)}
          </div>
        )}

        {!loading && !error && empty && (
          <EmptyState icon="📊" title={emptyTitle} message={emptyMessage} />
        )}

        {!loading && !error && !empty && children}
      </section>

      <SiteFooter />
    </main>
  );
}
