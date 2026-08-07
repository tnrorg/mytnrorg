// Sends OTP via WhatsApp (primary) with SMS backup, using Twilio.
// If Twilio env is missing, throws so the API can report a clear error.
let _client = null;
function client() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
  const twilio = require('twilio');
  _client = twilio(sid, token);
  return _client;
}

const body = (code) =>
  `TNR Election 2026\nYour One-Time Password is: ${code}\nآپ کا او ٹی پی: ${code}\nValid for 5 minutes. Do not share this code.`;

export async function sendWhatsApp(toE164, code) {
  const from = process.env.TWILIO_WHATSAPP_FROM; // whatsapp:+1415...
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM not set.');
  return client().messages.create({ from, to: `whatsapp:${toE164}`, body: body(code) });
}
export async function sendSms(toE164, code) {
  const from = process.env.TWILIO_SMS_FROM;
  if (!from) throw new Error('TWILIO_SMS_FROM not set.');
  return client().messages.create({ from, to: toE164, body: body(code) });
}

// Try WhatsApp first, fall back to SMS. Returns the channel that succeeded.
export async function sendOtp({ whatsapp, sms, code }) {
  const errors = [];
  if (whatsapp) {
    try { await sendWhatsApp(whatsapp, code); return { channel: 'whatsapp' }; }
    catch (e) { errors.push('whatsapp: ' + e.message); }
  }
  if (sms) {
    try { await sendSms(sms, code); return { channel: 'sms' }; }
    catch (e) { errors.push('sms: ' + e.message); }
  }
  throw new Error('OTP delivery failed. ' + errors.join(' | '));
}
