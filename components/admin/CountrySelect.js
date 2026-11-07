'use client';
import { COUNTRIES, PRIORITY_CODES } from '@/lib/geo/countries';

/* A country picker, for the places a country has to be chosen rather than
 * typed — currently a Country Ambassador's posting, on both the assign form
 * and the leadership edit form.
 *
 * WHY THE NAME IS STORED, NOT THE CODE.
 * This writes into `leadership_profiles.affiliation`, the same column that
 * holds a university for the other ambassador roster and an employer for the
 * Advisory Council. It is a display string: the public card prints it
 * straight out. Storing 'GB' there would put "GB" on the card and would mean
 * every reader of that column had to learn which rows are codes and which are
 * names.
 *
 * The list is bundled, not fetched — 198 countries from lib/geo/countries.js,
 * the same source the membership form uses, so the two can never offer
 * different spellings of the same place.
 */

const byName = (a, b) => a.name.localeCompare(b.name);

/* Ordered once at module load rather than on every render. Roundu's own
 * country and the places the diaspora actually lives come first: scrolling
 * past 190 countries to reach Pakistan is a poor first impression. */
const PRIORITY = PRIORITY_CODES
  .map(code => COUNTRIES.find(c => c.code === code))
  .filter(Boolean);
const REST = COUNTRIES
  .filter(c => !PRIORITY_CODES.includes(c.code))
  .sort(byName);

const ALL_NAMES = new Set(COUNTRIES.map(c => c.name));

export default function CountrySelect({
  value, onChange, className = '', autoFocus = false,
  placeholder = '— select a country —',
}) {
  const current = String(value || '');

  /* A value that is not one of the 198.
   *
   * Profiles created before this control existed hold whatever was typed —
   * "UK", "uae", or a university name on a row that was later moved to the
   * country roster. A <select> whose value matches no option renders BLANK,
   * and the next save would write that blank over a real answer without
   * anyone noticing. So an unrecognised value is kept as its own option,
   * labelled, and stays selected until somebody deliberately changes it. */
  const unlisted = current && !ALL_NAMES.has(current);

  return (
    <select
      className={className}
      value={current}
      autoFocus={autoFocus}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>

      {unlisted && (
        <option value={current}>{current} (not in the list — kept as typed)</option>
      )}

      <optgroup label="Most common">
        {PRIORITY.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
      </optgroup>

      <optgroup label="All countries">
        {REST.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
      </optgroup>
    </select>
  );
}
