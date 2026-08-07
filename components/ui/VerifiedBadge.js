import { COLORS } from '@/lib/design/tokens';

/* TNR verified badge — the familiar scalloped "burst" mark, in TNR gold with a
 * dark tick inside. Defined once here so the council, executive and member
 * directories cannot drift apart; previously the same SVG was pasted into
 * several files.
 *
 * `title` is what a screen reader announces. Pass `decorative` when the badge
 * sits next to text that already says "Verified", so it is not read twice.
 */
export default function VerifiedBadge({
  size = 16,
  fill = COLORS.gold500,
  tick = COLORS.charcoal,
  title = 'Verified member',
  decorative = false,
  className = '',
  style,
}) {
  const a11y = decorative
    ? { 'aria-hidden': 'true' }
    : { role: 'img', 'aria-label': title };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`}
      style={style} {...a11y}>
      {/* Twelve-lobed scalloped disc */}
      <path fill={fill} d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" />
      {/* Tick, drawn as a stroke so it stays crisp at small sizes */}
      <path d="M8.1 12.2l2.6 2.6 5.2-5.4" fill="none" stroke={tick}
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
