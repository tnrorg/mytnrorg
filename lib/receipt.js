import crypto from 'crypto';
export function makeReceiptCode(year = process.env.NEXT_PUBLIC_ELECTION_YEAR || '2026') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return `TNR-${year}-${s}`;
}
