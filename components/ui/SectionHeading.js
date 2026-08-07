import { FONT, COLORS } from '@/lib/design/tokens';

/** One heading treatment for every section, so type hierarchy stops drifting
 *  page to page. `as` keeps the heading level semantically correct. */
export default function SectionHeading({
  eyebrow, title, lead, align = 'left', as: Tag = 'h2', tone = 'dark', className = '',
}) {
  const center = align === 'center';
  const light = tone === 'light';
  return (
    <div className={`${center ? 'text-center mx-auto max-w-2xl' : ''} ${className}`} style={FONT}>
      {eyebrow && (
        <div className="text-[11px] font-bold uppercase tracking-[.16em]"
          style={{ color: light ? COLORS.gold400 : COLORS.green700 }}>{eyebrow}</div>
      )}
      <Tag className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight"
        style={{ color: light ? '#fff' : COLORS.green900 }}>{title}</Tag>
      {lead && (
        <p className="mt-2.5 text-sm leading-relaxed"
          style={{ color: light ? 'rgba(255,255,255,.68)' : COLORS.muted }}>{lead}</p>
      )}
      <div className={`mt-3 h-[2px] w-12 ${center ? 'mx-auto' : ''}`}
        style={{ background: COLORS.gold500 }} />
    </div>
  );
}
