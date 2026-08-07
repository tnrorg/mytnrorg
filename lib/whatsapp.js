// Sends messages via the self-hosted (free) WhatsApp service in /whatsapp-service.
const BASE = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4000';
const KEY  = process.env.WA_API_KEY || 'tnr_wa_key_change_me';

export async function sendWhatsAppLocal(toE164, message) {
  const res = await fetch(`${BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify({ to: toE164, message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `whatsapp service error (${res.status})`);
  return data;
}
export async function whatsappStatus() {
  try { const r = await fetch(`${BASE}/status`); return await r.json(); } catch { return { connected: false }; }
}
