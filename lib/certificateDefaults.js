// Defaults for the membership-certificate template. Used when the
// certificate_settings row has not been created yet (migration not run), so
// the certificate always renders complete text rather than blank spaces.
export const CERT_DEFAULTS = {
  org_line1: 'TEHREEK-E-NOJAWANAN ROUNDU',
  org_line2: 'ROUNDU · GILGIT-BALTISTAN',
  logo_url: '/tnr-logo.png',
  cert_title: 'Certificate of Membership',
  intro_line: 'This is to certify that',
  body_text:
    'bearing Membership ID {{membership_id}} of {{village}}, Union Council {{union_council}}, ' +
    'is a duly registered {{member_type}} of Tehreek-e-Nojawanan Roundu, and is entitled to ' +
    'all rights and privileges of membership.',
  signatory_title: 'Central President',
  signatory_org: 'Tehreek-e-Nojawanan Roundu',
  signature_url: '/signature.png',
  scan_label: 'SCAN TO VERIFY',
  issued_label: 'Issued on',
  accent_gold: '#C9A227',
  accent_green: '#0B3D2E',
  show_border: true,
  show_qr: true,
};

/** Tokens an admin may use in body_text, with the label shown in the editor. */
export const CERT_TOKENS = [
  ['{{name}}', 'Member full name'],
  ['{{membership_id}}', 'Membership number, e.g. TNR-MN-0001'],
  ['{{village}}', 'Village'],
  ['{{union_council}}', 'Union Council'],
  ['{{member_type}}', 'General Member, Advisory Council, etc.'],
];

/**
 * Replace {{tokens}} with the member's details.
 *
 * A missing value collapses the whole clause around it rather than printing
 * "of , Union Council ," — an empty village should read as if the sentence
 * never mentioned one.
 */
export function fillCertificate(text, m = {}) {
  const values = {
    name: m.full_name || '',
    membership_id: m.membership_id || '',
    village: m.village || '',
    union_council: m.union_council || '',
    member_type: m.memberPhrase || m.memberType || 'General Member',
  };

  let out = String(text || '');
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'), v);
  }

  return out
    // "of , Union Council X" → "Union Council X"
    .replace(/\bof\s*,\s*/gi, '')
    // "Union Council ," → ""
    .replace(/,?\s*Union Council\s*,/gi, ',')
    // collapse doubled separators left by an empty value
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .trim();
}
