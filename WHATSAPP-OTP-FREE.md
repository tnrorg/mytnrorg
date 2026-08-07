# 📲 Free WhatsApp OTP — Setup Guide

Send real WhatsApp OTPs to your members **for free** (no Twilio, no per-message charges).
This uses a small self-hosted service that logs in **one WhatsApp number** like WhatsApp Web
(via the open-source [Baileys](https://github.com/WhiskeySockets/Baileys) library).

> ⚠️ **Honest note:** This is *unofficial* — it's not the paid WhatsApp Business API. It works
> great for a one-time internal election, but sending to hundreds of numbers from one account
> carries a small risk WhatsApp temporarily flags/blocks that number. Use a **dedicated org
> number** (not your personal one), warm it up, and space out sends if you can. For a single
> election day with ~500 members this is normally fine.

---

## How it works
```
Member enters mobile → TNR app → (POST /send) → WhatsApp service → member's WhatsApp
```
The TNR app never touches WhatsApp directly — it just calls the local service.

## 1. Install the service (one time)
```bash
cd E:\tnr\TNR\whatsapp-service
npm install
```

## 2. Start it and link your WhatsApp number
```bash
npm start
```
Then open **http://localhost:4000** in your browser — a QR code appears.
On the phone with your **org WhatsApp number**:
WhatsApp → **Settings → Linked Devices → Link a device** → scan the QR.

When it says **✅ WhatsApp linked**, leave this window running.
(The login is saved in `whatsapp-service/auth/`, so you won't need to re-scan next time.)

## 3. Point the TNR app at it
In your **`.env.local`** (in `E:\tnr\TNR`), make sure you have:
```
OTP_PROVIDER=whatsapp
WHATSAPP_SERVICE_URL=http://localhost:4000
WA_API_KEY=tnr_wa_key_change_me
```
Use the **same `WA_API_KEY`** value in both the app and the service.
To set the key for the service, start it like:
```bash
# Windows PowerShell
$env:WA_API_KEY="tnr_wa_key_change_me"; npm start
```
Restart `npm run dev` in the main app after editing `.env.local`.

## 4. Test
Go to `http://localhost:3000/vote`, enter a **registered + approved** member's mobile
(that number must be **on the locked voter list**), and the OTP arrives on WhatsApp. ✅

---

## Running order on election day
Open **two terminals**:

| Terminal | Folder | Command |
|---|---|---|
| 1 — WhatsApp service | `E:\tnr\TNR\whatsapp-service` | `npm start` (keep running, stay linked) |
| 2 — TNR app | `E:\tnr\TNR` | `npm run dev` |

## Switching providers
`OTP_PROVIDER` in `.env.local`:
- `whatsapp` → free self-hosted service (this guide) ✅ recommended
- `twilio` → paid Twilio (WhatsApp then SMS backup)
- `dev` → no sending; the code is shown on screen (for local testing only)

## Troubleshooting
- **"whatsapp not linked yet"** → open http://localhost:4000 and scan the QR.
- **"number not on WhatsApp"** → that member's number has no WhatsApp; use `twilio` or SMS for them.
- **Got logged out** → delete the `whatsapp-service/auth` folder and re-scan.
- **Keep the service window open** the whole time voting is live.
