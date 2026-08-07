/**
 * TNR — Free WhatsApp OTP sender (self-hosted, no per-message cost).
 * Runs ONE WhatsApp number like WhatsApp Web using Baileys.
 *
 *  1) npm install   (inside this folder)
 *  2) npm start
 *  3) Open http://localhost:4000  → scan the QR with the ORG's WhatsApp
 *     (WhatsApp → Settings → Linked Devices → Link a device)
 *  4) The Next.js app calls POST /send to deliver OTPs.
 *
 * Security: every /send call must include header  x-api-key: <WA_API_KEY>.
 */
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const PORT = process.env.WA_PORT || 4000;
const API_KEY = process.env.WA_API_KEY || 'tnr_wa_key_change_me';
const AUTH_DIR = path.join(__dirname, 'auth');

let sock = null;
let currentQR = null;         // latest QR string (until linked)
let connected = false;
let meNumber = null;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { currentQR = qr; connected = false; }
    if (connection === 'open') {
      connected = true; currentQR = null;
      meNumber = sock.user?.id?.split(':')[0] || null;
      console.log('✅ WhatsApp linked as', meNumber);
    }
    if (connection === 'close') {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log('⚠️  connection closed.', loggedOut ? 'Logged out — delete /auth and re-link.' : 'Reconnecting…');
      if (!loggedOut) start().catch(console.error);
    }
  });
}

// convert +923001234567 / 03001234567 → 923001234567@s.whatsapp.net
function toJid(raw) {
  let s = String(raw || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('00')) s = s.slice(2);
  return s + '@s.whatsapp.net';
}

const app = express();
app.use(express.json());

// simple status/QR page
app.get('/', async (_req, res) => {
  if (connected) return res.send(`<div style="font-family:sans-serif;text-align:center;padding:40px">
    <h2 style="color:#0B3D2E">✅ WhatsApp linked</h2><p>Number: <b>${meNumber || '—'}</b></p>
    <p>The TNR portal can now send OTPs. Keep this window running during the election.</p></div>`);
  if (!currentQR) return res.send('<div style="font-family:sans-serif;text-align:center;padding:40px"><h3>Starting… refresh in a moment.</h3></div>');
  const dataUrl = await QRCode.toDataURL(currentQR, { margin: 1, width: 320 });
  res.send(`<div style="font-family:sans-serif;text-align:center;padding:30px">
    <h2 style="color:#0B3D2E">Link TNR WhatsApp</h2>
    <p>Open WhatsApp → <b>Settings → Linked Devices → Link a device</b> and scan:</p>
    <img src="${dataUrl}" style="border:8px solid #C9A227;border-radius:16px"/>
    <p style="color:#888">This page auto-refreshes.</p>
    <script>setTimeout(()=>location.reload(),8000)</script></div>`);
});

app.get('/status', (_req, res) => res.json({ connected, number: meNumber }));

app.post('/send', async (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ ok: false, error: 'bad api key' });
  if (!connected) return res.status(503).json({ ok: false, error: 'whatsapp not linked yet' });
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: 'to and message required' });
  try {
    const jid = toJid(to);
    // verify the number is on WhatsApp
    const [chk] = await sock.onWhatsApp(jid).catch(() => [null]);
    if (chk && chk.exists === false) return res.status(422).json({ ok: false, error: 'number not on WhatsApp' });
    await sock.sendMessage(jid, { text: message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`TNR WhatsApp service on http://localhost:${PORT}  (open it to scan QR)`));
start().catch(console.error);
