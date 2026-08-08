// Admin-editable content for the utility bar above the main navigation.
// Stored in `membership_settings` as key/value, same as the email branding, so
// changing a social link is an admin action rather than a code change.
//
// Empty string means "hide this item" — an organisation without a Twitter
// account should show no Twitter icon, not one linking to twitter.com.
export const HEADER_DEFAULTS = {
  header_tagline: 'Uniting the Rondo Community Worldwide',
  social_facebook: '',
  social_instagram: '',
  social_youtube: '',
  social_linkedin: '',
  social_twitter: '',
  social_whatsapp: '',
};

/** Order shown in the bar, with the short label used in the icon chip. */
export const SOCIALS = [
  ['social_facebook', 'f', 'Facebook'],
  ['social_instagram', 'ig', 'Instagram'],
  ['social_youtube', 'y', 'YouTube'],
  ['social_linkedin', 'in', 'LinkedIn'],
  ['social_twitter', 'x', 'X / Twitter'],
  ['social_whatsapp', 'wa', 'WhatsApp'],
];

/**
 * Accept what an admin will realistically paste and return something a browser
 * can follow — or null, so a malformed entry hides the icon rather than
 * producing a dead link on every page of the site.
 */
export function normaliseUrl(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(javascript|data):/i.test(s)) return null;   // never emit these
  return `https://${s.replace(/^\/+/, '')}`;
}
