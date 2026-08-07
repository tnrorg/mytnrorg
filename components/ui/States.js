import { FONT, COLORS } from '@/lib/design/tokens';

const shell = 'rounded-tnr-lg bg-white border border-gray-100 p-10 text-center';

/** Shown when a query legitimately returns nothing. Distinct from an error —
 *  the audit found pages that conflated the two, which reads as a fault. */
export function EmptyState({ icon = '📄', title, message, action, className = '' }) {
  return (
    <div className={`${shell} ${className}`} style={FONT} role="status">
      <div className="text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="mt-3 font-extrabold" style={{ color: COLORS.green900 }}>{title}</h3>
      {message && <p className="mt-1 text-sm" style={{ color: COLORS.muted }}>{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shown when something actually failed. Surfaces the reason — a silent
 *  failure is impossible to diagnose from a screenshot. */
export function ErrorState({ title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <div className={`${shell} ${className}`} style={FONT} role="alert">
      <div className="text-4xl" aria-hidden="true">⚠️</div>
      <h3 className="mt-3 font-extrabold" style={{ color: COLORS.green900 }}>{title}</h3>
      {message && <p className="mt-1 text-xs" style={{ color: COLORS.muted }}>{message}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="mt-5 rounded-tnr px-4 py-2 text-sm font-bold text-white transition-opacity duration-micro hover:opacity-90"
          style={{ background: COLORS.green700 }}>Try again</button>
      )}
    </div>
  );
}

/** Skeleton block. `lines` renders stacked bars; otherwise a single panel. */
export function Skeleton({ className = '', lines = 0, height = 'h-24' }) {
  if (lines > 0) return (
    <div className={`animate-pulse space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-gray-100" style={{ width: `${100 - i * 7}%` }} />
      ))}
    </div>
  );
  return <div className={`animate-pulse rounded-tnr-lg bg-gray-100 ${height} ${className}`} aria-hidden="true" />;
}

/** Status badge. Carries an icon as well as colour, because the spec forbids
 *  relying on colour alone to communicate state. */
const TONES = {
  active:    ['#0F5138', '#E8F2ED', '✔'],
  pending:   ['#8A6410', '#FBF3DF', '◔'],
  suspended: ['#9B1C1C', '#FDECEC', '⊘'],
  neutral:   ['#4B5563', '#F1F4F2', '•'],
  gold:      ['#7A5C10', '#FAF2DC', '★'],
};
export function StatusBadge({ tone = 'neutral', children, className = '' }) {
  const [fg, bg, icon] = TONES[tone] || TONES.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}
      style={{ ...FONT, color: fg, background: bg }}>
      <span aria-hidden="true">{icon}</span>{children}
    </span>
  );
}
