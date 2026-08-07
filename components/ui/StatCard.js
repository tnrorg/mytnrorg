import CountUp from './CountUp';
import { FONT, COLORS } from '@/lib/design/tokens';

/** Dashboard statistic. `value` must come from real data — pass null while
 *  loading and the card shows a placeholder rather than a fabricated zero. */
export default function StatCard({
  label, value, hint, icon, tone = 'green', animate = true, className = '',
}) {
  const accent = { green: COLORS.green700, deep: COLORS.green900, gold: COLORS.gold500 }[tone] || COLORS.green700;
  const loading = value === null || value === undefined;
  return (
    <div className={`rounded-tnr-lg bg-white border border-gray-100 p-5 shadow-tnr-flat
      transition-transform duration-standard hover:-translate-y-[3px] hover:shadow-tnr-raise ${className}`} style={FONT}>
      {icon && <div className="mb-2 text-xl" aria-hidden="true" style={{ color: accent }}>{icon}</div>}
      <div className="text-3xl font-extrabold leading-none" style={{ color: accent }}>
        {loading ? <span className="text-gray-200">—</span>
          : animate && typeof value === 'number' ? <CountUp value={value} /> : value}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>
        {label}
      </div>
      {hint && <div className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>{hint}</div>}
    </div>
  );
}
