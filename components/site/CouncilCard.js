'use client';
import { useState } from 'react';
import { initials } from '@/content/advisoryCouncil';
import { COLORS, FONT } from '@/lib/design/tokens';

// One of the 29 duplicated palettes the audit found — now sourced from tokens.
const C = { deep: COLORS.green900, green: COLORS.green700, gold: COLORS.gold500 };

// Photo with an initials fallback: a member without a photo file still gets a
// complete-looking card instead of a broken image icon.
export function CouncilPhoto({ member, size = 'card' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'large' ? 'w-40 h-40 text-4xl' : 'w-full aspect-[4/5] text-3xl';
  const radius = size === 'large' ? 'rounded-2xl' : 'rounded-xl';

  if (failed) {
    return (
      <div className={`${box} ${radius} grid place-items-center font-extrabold text-white shrink-0`}
        style={{ background: `linear-gradient(140deg, ${C.green}, ${C.deep})` }}
        role="img" aria-label={member.name}>
        <span aria-hidden="true">{initials(member.name)}</span>
      </div>
    );
  }
  // Admin-uploaded photo wins; otherwise fall back to the /public file convention.
  const src = member.photo_url || `/advisory/${member.slug}.jpg`;
  return (
    <img src={src} alt={member.name} onError={() => setFailed(true)}
      className={`${box} ${radius} object-cover object-top shrink-0 bg-gray-100`} />
  );
}

export default function CouncilCard({ member }) {
  return (
    /* h-full so the card fills its grid row, and the button below carries
       mt-auto so every card in a row ends on one baseline. Members list
       different numbers of interests, so without this the buttons stepped up
       and down across the row — barely noticeable on a capped preview of
       eight, obvious now the homepage shows the whole council. */
    <article style={FONT}
      className="rounded-tnr-lg bg-white border border-gray-100 p-4 flex h-full flex-col shadow-tnr-flat
        transition-all duration-standard hover:-translate-y-[3px] hover:shadow-tnr-raise
        hover:border-[rgba(23,107,73,.22)]">
      <CouncilPhoto member={member} />

      <h3 className="mt-4 font-black text-[15px] leading-snug text-center" style={{ color: C.deep }}>{member.name}</h3>
      <div className="mt-1 text-center text-[12px] font-bold" style={{ color: C.green }}>
        {member.degree}{member.field && <><br /><span className="font-semibold">({member.field})</span></>}
      </div>
      <p className="mt-2 text-center text-[12px] leading-snug" style={{ color: COLORS.muted }}>{member.affiliation}</p>
      {(member.village || member.tenure) && (
        <p className="mt-1 text-center text-[11px]" style={{ color: COLORS.muted }}>
          {[member.village, member.tenure].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-[10px] font-bold uppercase tracking-[.14em] text-center mb-2" style={{ color: C.gold }}>
          Interests / Expertise
        </div>
        <ul className="space-y-1">
          {(member.expertise || []).slice(0, 3).map(e => (
            <li key={e} className="flex gap-2 text-[12px] text-gray-600 leading-snug">
              <span className="mt-[6px] shrink-0 w-1 h-1 rounded-full" style={{ background: C.gold }} />
              <span>{e}</span>
            </li>
          ))}
          {(member.expertise || []).length > 3 && (
            <li className="text-[11px] text-gray-400 pl-3">+{(member.expertise || []).length - 3} more</li>
          )}
        </ul>
      </div>

      {/* Wrapper carries the mt-auto, not the button. A margin cannot be both
          "as large as possible" and "at least this much", so pinning via the
          wrapper and spacing via its padding keeps a guaranteed gap above the
          button even on the tallest card in the row. */}
      <div className="mt-auto pt-4">
        <a href={`/council/${member.slug}`}
          className="tnr-btn-profile block text-center text-[12px] font-bold py-2.5 rounded-tnr"
          style={{ background: 'rgba(23,107,73,.08)', color: C.green }}>
          View Profile
        </a>
      </div>
    </article>
  );
}
