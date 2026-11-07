'use client';
import { useState } from 'react';
import { academicTitle } from '@/lib/membership/options';
import { isAmbassadorBody } from '@/lib/membership/roles';
import { countryCode } from '@/lib/geo/countries';
import LeadershipCard from '@/components/leadership/LeadershipCard';
import { COLORS } from '@/lib/design/tokens';

// Sourced from the shared design tokens rather than redeclared locally.
const C = { deep: COLORS.green900, green: COLORS.green700, gold: COLORS.gold500 };

// Monogram for admin-created rows, which have no hard-coded monogram field.
const initialsOf = (m) => String(m.designation || m.name || '?')
  .split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* The chip stamped on the card, by body.
 *
 * SHORT ON PURPOSE, and singular. The chip has about 112px on a 360px phone:
 * "Central Executive Committee" is clipped there, "Executive Committee" is
 * not. Singular because the card is one person — "Country Ambassador" is what
 * this person IS; "Country Ambassadors" is the roster they are listed in. */
const CHIP = {
  advisory: 'Advisory Council',
  executive: 'Executive Committee',
  country_ambassador: 'Country Ambassador',
  ambassador: 'University Ambassador',
};

/* The circular portrait, kept for the profile pages that still use it.
 *
 * The ROSTER cards no longer do — they render the shared LeadershipCard, with
 * its tall 4:5 portrait and the name on frosted glass. This export remains
 * because /about/executive-committee/[slug] and the council profile header
 * import it for a single large photograph, where a circle is right. */
export function ExecutivePhoto({ member, size = 'card' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'large' ? 'w-44 h-44' : 'w-20 h-20 sm:w-28 sm:h-28';

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

/* A roster card for the Central Executive Committee and both ambassador
 * bodies.
 *
 * AN ADAPTER, NOT A DESIGN. Everything visual lives in LeadershipCard, which
 * the Advisory Council also renders — so the four rosters cannot drift apart,
 * and a fix to the hover outline or the mobile type scale lands on all of them
 * at once. What belongs here is only the mapping from a leadership_profiles
 * row to that card's props, plus the two things this side has that the council
 * roster does not: unfilled seats, and a flag.
 */
export default function ExecutiveCard({ member, index = 0 }) {
  const named = !!member.name;

  const chip = CHIP[member.body] || 'TNR Leadership';

  /* The office outranks the day job on a leadership card. "President" tells a
     visitor what this person does FOR TNR, which is the question the roster
     exists to answer; "Senior Research Officer" is who they are elsewhere.

     UNLESS THE OFFICE IS JUST THE BODY'S NAME. Both ambassador rosters default
     the designation to the role itself, so an ambassador card would have read
     "Country Ambassador" in the chip and "Country Ambassador" again directly
     under the name — the same words twice, crowding out the one line that says
     something about the person. When the designation only repeats the chip it
     is dropped, and the profession or the degree takes the line instead. */
  const designation = String(member.designation || '').trim();
  /* Compared with a trailing plural stripped, because the stored values do not
     agree with themselves: the first ambassadors were assigned the designation
     "University Ambassadors" — the name of the ROSTER — while the chip names
     the PERSON, "University Ambassador". An exact match would have missed by
     one letter and put the two side by side anyway. */
  const sameAsChip = (a, b) => {
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/s$/, '');
    return norm(a) === norm(b);
  };
  const office = sameAsChip(designation, chip) ? '' : designation;
  const role = office
    || member.profession
    || academicTitle(member.qualification, member.field);

  /* The campus or the country, under the portrait — the whole point of the
     ambassador rosters is WHICH place the person covers. On the Advisory
     Council and the CEC the affiliation is an employer, which belongs in the
     same slot for the same reason: it is what a visitor is scanning for.

     isAmbassadorBody, not `body === 'ambassador'`. That literal reads like
     "any ambassador" and in fact means "university only" — the Country
     roster's body key is 'country_ambassador'. */
  const place = member.affiliation || member.organisation || '';

  /* Empty unless this is the country roster AND the stored affiliation is one
     of the 198 known countries. BOTH conditions: a university name that
     happened to match a country — "Georgia", "Jordan" — would otherwise fly a
     flag on the campus roster. */
  const flagCode = member.body === 'country_ambassador' ? countryCode(place) : '';

  return (
    <LeadershipCard
      index={index}
      slug={member.slug}
      bodyLabel={chip}
      /* An unfilled post still gets a card, so the establishment reads as a
         whole rather than as a list with gaps. It is named as vacant and is
         not badged as verified. */
      name={named ? member.name : 'To Be Announced'}
      verified={named}
      role={role}
      photoUrl={member.photo_url || null}
      photoPosition={member.photo_position}
      monogram={member.monogram || initialsOf(member)}
      meta={[place, isAmbassadorBody(member.body) ? '' : member.country]}
      metaFlagCode={flagCode}
      /* A filled position goes straight to the person's full professional
         profile — that is what a visitor clicking a face expects. The office
         description page is only useful when nobody holds the post yet, and
         the duties appear on the profile anyway. */
      href={named ? `/council/${member.slug}` : `/about/executive-committee/${member.slug}`}
      cta={named ? 'View profile' : 'About this position'}
    />
  );
}
