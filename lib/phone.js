// Normalize a locally-entered number to E.164 using DEFAULT_COUNTRY_CODE.
export function normalizePhone(raw, defaultCc = process.env.DEFAULT_COUNTRY_CODE || '92') {
  if (!raw) return '';
  let s = String(raw).trim().replace(/[\s\-()]/g, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return '+' + s.slice(2);
  if (s.startsWith('0')) return '+' + defaultCc + s.slice(1);       // 0300... -> +92300...
  if (s.startsWith(defaultCc)) return '+' + s;
  if (s.length >= 11) return '+' + s;      // already includes a country code
  return '+' + defaultCc + s;
}
export function samePhone(a, b) { return normalizePhone(a) === normalizePhone(b); }
