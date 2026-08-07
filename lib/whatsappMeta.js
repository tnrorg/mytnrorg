// Meta WhatsApp Cloud API — OTP sender (direct, no Twilio/third-party).
// Requires an APPROVED WhatsApp message template (Authentication or Utility category).
// Configure via environment variables only. Never expose these on the client.
export async function sendWhatsAppMetaOtp(toE164, code) {
  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  const version = process.env.META_WA_API_VERSION || 'v21.0';
  if (!token || !phoneId) {
    const e = new Error('Meta WhatsApp not configured (META_WA_TOKEN / META_WA_PHONE_NUMBER_ID).');
    e.notConfigured = true; throw e;
  }
  const templateName = process.env.META_WA_TEMPLATE_NAME || 'otp_verification';
  const lang         = process.env.META_WA_TEMPLATE_LANG || 'en';
  const hasButton    = (process.env.META_WA_TEMPLATE_HAS_BUTTON || 'true') !== 'false';
  const to = String(toE164).replace(/[^\d]/g, ''); // Meta wants digits only, no '+'

  // Authentication templates: body has the code variable; the copy-code button repeats it.
  const components = [
    { type: 'body', parameters: [{ type: 'text', text: String(code) }] },
  ];
  if (hasButton) {
    components.push({ type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: String(code) }] });
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name: templateName, language: { code: lang }, components },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error('WhatsApp API error: ' + msg);
  }
  return { channel: 'whatsapp', id: data?.messages?.[0]?.id || null };
}
