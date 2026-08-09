'use client';
import { academicTitle } from '@/lib/membership/options';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { COLORS, FONT } from '@/lib/design/tokens';
import { useState } from 'react';

// Monogram for admin-created rows, which have no hard-coded monogram field.
const initialsOf = (m) => String(m.designation || m.name || '?')
  .split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Sourced from the shared design tokens rather than redeclared locally.
const C = { deep: COLORS.green900, green: COLORS.green700, gold: COLORS.gold500 };

export function ExecutivePhoto({ member, size = 'card' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'large' ? 'w-44 h-44' : 'w-28 h-28';

  return (
    <div className={`${box} rounded-full p-[3px] mx-auto shrink-0`}
      style={{ background: `linear-gradient(140deg, ${C.gold}, ${C.goldLt} 45%, ${C.gold})` }}>
      {failed
        ? <div className="w-full h-full rounded-full grid place-items-center font-black text-white"
            style={{ background: `linear-gradient(140deg, ${C.green}, ${C.deep})`,
                     fontSize: size === 'large' ? 44 : 28, letterSpacing: '.04em' }}>
            {member.monogram || initialsOf(member)}
          </div>
        : <img src={member.photo_url || `/executive/${member.slug}.jpg`} alt={member.name || member.designation}
            onError={() => setFailed(true)}
            className="w-full h-full rounded-full object-cover object-top bg-gray-100" />}
    </div>
  );
}

export default function ExecutiveCard({ member }) {
  const named = !!member.name;
  // Gold hairline ring to match the council cards, and a lighter lift than
  // the old shadow-2xl / -translate-y-1.5, which the design system disallows.
  // Deliberately not .tnr-glass: the portrait needs an opaque backdrop, and a
  // blur behind a face reads as a rendering fault rather than an effect. It
  // takes the gold hairline and the shared lift so it still belongs to the set.
  return (
    <article className="tnr-ring-gold tnr-lift group relative h-full rounded-tnr-lg bg-white overflow-hidden flex flex-col
      border border-[rgba(200,154,43,.35)] shadow-tnr-flat transition-colors duration-standard
      hover:border-[rgba(200,154,43,.75)]">
      {/* deep-green crown behind the portrait, the way the printed cards read */}
      <div className="h-20" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.green})` }} />
      <div className="-mt-16 px-6 pb-6 flex flex-col flex-1">
        <ExecutivePhoto member={member} />

        <div className="mt-4 text-center">
          <div className="inline-block text-[10px] font-black uppercase tracking-[.18em] px-3 py-1 rounded-full"
            style={{ background: '#F3E4B3', color: C.deep }}>{member.designation}</div>
        </div>

        <h3 className="mt-3 text-center font-black text-[17px] leading-snug flex items-center justify-center gap-1.5"
          style={{ color: named ? C.deep : '#9CA3AF' }}>
          {named ? member.name : 'To Be Announced'}
          {/* Gold verified badge, same as the council and members directory —
              a filled seat is a confirmed office bearer. */}
          {/* A filled seat is a confirmed office bearer. */}
          {named && <VerifiedBadge size={16} />}
        </h3>

        {/* Current profession is what the card is for — what this person does
            today. The degree only stands in when no profession is recorded,
            and the full qualification is on their profile page either way.
            Same precedence as the council roster cards. */}
        {(member.profession || academicTitle(member.qualification, member.field)) && (
          <p className="mt-1 text-center text-[12.5px] font-semibold" style={{ color: C.green }}>
            {member.profession || academicTitle(member.qualification, member.field)}
          </p>
        )}

        <p className="mt-3 text-center text-[13px] text-gray-500 leading-relaxed flex-1">{member.summary}</p>

        {/* A filled position goes straight to the person's full professional
            profile — that is what a visitor clicking a face expects. The office
            description page is only useful when nobody holds the post yet, and
            the duties appear on the profile anyway. */}
        <a href={member.name ? `/council/${member.slug}` : `/about/executive-committee/${member.slug}`}
          className="tnr-btn-profile mt-5 block text-center text-[12.5px] font-bold py-2.5 rounded-xl text-white"
          style={{ background: C.deep }}>
          {member.name ? 'View Profile' : 'About This Position'}
        </a>
      </div>
    </article>
  );
}
