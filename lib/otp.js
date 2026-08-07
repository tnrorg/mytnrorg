import crypto from 'crypto';

export function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
export function hashOtp(code) {
  const secret = process.env.JWT_SECRET || 'tnr_secret';
  return crypto.createHmac('sha256', secret).update(String(code)).digest('hex');
}
export function verifyOtpHash(code, hash) {
  const h = hashOtp(code);
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)); }
  catch { return false; }
}
export const OTP_TTL_MS = 5 * 60 * 1000;         // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
