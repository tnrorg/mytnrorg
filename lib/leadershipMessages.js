/* Shape and headings for the home-page Founder / President messages.
 *
 * Only the section HEADINGS have defaults. Names, photos, designations and the
 * message text are left blank on purpose — inventing leadership names or words
 * and putting them on the public home page would be worse than an empty
 * section, so the section hides itself until an admin has written one.
 */
export const MESSAGE_KEYS = ['founder', 'president'];

export const MESSAGE_DEFAULTS = {
  founder:   { key: 'founder',   heading: 'From Our Founder',   designation: 'Founder',           sort_order: 1 },
  president: { key: 'president', heading: 'From Our President', designation: 'Central President', sort_order: 2 },
};

/** A blank, editable row — used before the migration has been run. */
export const blankMessage = (key) => ({
  name: '', message: '', photo_url: null, signature_url: null,
  published: false, ...MESSAGE_DEFAULTS[key],
});

/** Ready to show publicly: switched on AND actually written. */
export const isPublishable = (m) => !!(m && m.published && String(m.message || '').trim());
