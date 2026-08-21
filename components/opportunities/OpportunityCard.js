'use client';
import Image from 'next/image';
import { Briefcase, CalendarDays, Building2 } from 'lucide-react';
import { COLORS } from '@/lib/design/tokens';
import {
  categoryLabel, CATEGORY_TONE, STATUS_LABEL, STATUS_TONE, fmtDate,
} from '@/lib/opportunities';

/* One opportunity card. Used by BOTH the public listing and the member portal.
 *
 * The same component on purpose: the two surfaces must show identical teaser
 * information, and building them separately is how they end up disagreeing
 * about a deadline. What differs is only where "View Details" leads, which the
 * parent decides.
 *
 * This component is never given member-only fields — the public API does not
 * return them — so it cannot leak one by accident.
 */
export default function OpportunityCard({ o, onView, ctaLabel = 'View Details', footer }) {
  const cat = categoryLabel(o);
  const catTone = CATEGORY_TONE[o.category] || CATEGORY_TONE.Other;
  const state = o.state || 'open';
  const tone = STATUS_TONE[state] || STATUS_TONE.open;
  const closed = state === 'closed';

  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100
      bg-white shadow-tnr-flat transition-all duration-standard
      ${closed ? 'opacity-75' : 'hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]'}`}>

      <div className="relative aspect-[16/9] bg-gray-100">
        {o.cover_url ? (
          <Image src={o.cover_url} alt="" fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center"
            style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
            <Briefcase size={28} className="text-white/30" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{ background: tone.bg, color: tone.fg, backdropFilter: 'blur(4px)' }}>
          {STATUS_LABEL[state]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span className="inline-block w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{ background: catTone.bg, color: catTone.fg }}>{cat}</span>

        <h3 className="mt-2.5 font-black text-[17px] leading-snug" style={{ color: COLORS.green900 }}>
          {o.title}
        </h3>

        {o.organization && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-gray-600">
            <Building2 size={12} aria-hidden="true" className="shrink-0" />
            {o.organization}
          </p>
        )}

        {o.short_description && (
          <p className="mt-2 text-[13.5px] text-gray-600 leading-relaxed line-clamp-2">
            {o.short_description}
          </p>
        )}

        <div className="mt-auto pt-4">
          {(o.deadline || o.closes_at) && (
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: closed ? '#64748B' : COLORS.green700 }}>
              <CalendarDays size={12} aria-hidden="true" />
              {closed ? 'Closed' : 'Deadline'}: {fmtDate(o.closes_at || o.deadline)}
            </p>
          )}

          {footer}

          <button onClick={() => onView?.(o)}
            className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity
              disabled:opacity-50"
            style={{ background: closed ? '#64748B' : COLORS.green700 }}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
