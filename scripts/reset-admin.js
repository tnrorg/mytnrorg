/**
 * TNR — Admin diagnostics & password reset
 *
 *   node scripts/reset-admin.js                 → checks DB, resets admin/admin123
 *   node scripts/reset-admin.js myNewPassword   → resets admin to a password you choose
 *   node scripts/reset-admin.js user pass        → sets/creates a specific username
 *
 * Run this from the project root (E:\tnr\TNR) after filling in .env.local.
 * It reads .env.local, connects with the SERVICE ROLE key, and fixes the admin
 * account using a bcryptjs hash (100% compatible with the login route).
 */
const fs = require('fs');
const path = require('path');

// ---- load .env.local (simple parser) ----
function loadEnv(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== TNR admin diagnostics ===');
console.log('SUPABASE URL:', URL || '❌ MISSING');
if (URL && /\/rest\/v1\/?$/.test(URL)) {
  console.log('⚠️  Your URL ends with /rest/v1 — REMOVE that. It must be just https://xxxx.supabase.co');
}
console.log('SERVICE ROLE KEY:', SVC ? (SVC.slice(0, 6) + '…' + SVC.slice(-4)) : '❌ MISSING');
if (!URL || !SVC) {
  console.log('\n❌ .env.local is missing Supabase values. Fix that first, then re-run.\n');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const sb = createClient(URL, SVC, { auth: { persistSession: false } });

const args = process.argv.slice(2);
let username = 'admin', password = 'admin123';
if (args.length === 1) password = args[0];
if (args.length >= 2) { username = args[0]; password = args[1]; }

(async () => {
  // 1) connectivity + schema check
  const { error: tblErr } = await sb.from('admin_users').select('id', { count: 'exact', head: true });
  if (tblErr) {
    console.log('\n❌ Could not read admin_users:', tblErr.message);
    if (/does not exist|schema cache|relation/i.test(tblErr.message))
      console.log('   → The tables aren’t created. Run supabase/schema.sql (then seed.sql) in Supabase SQL Editor.');
    else if (/JWT|apikey|invalid/i.test(tblErr.message))
      console.log('   → The SERVICE ROLE key is wrong. Copy it again from Supabase → Settings → API.');
    else
      console.log('   → Check the URL/key are correct and the project is running.');
    process.exit(1);
  }
  console.log('✅ Connected & tables exist.');

  // 2) upsert admin with a bcryptjs hash
  const hash = await bcrypt.hash(password, 10);
  const { data: existing } = await sb.from('admin_users').select('id').eq('username', username).maybeSingle();
  if (existing) {
    await sb.from('admin_users').update({ password_hash: hash }).eq('id', existing.id);
    console.log(`✅ Reset password for existing admin "${username}".`);
  } else {
    await sb.from('admin_users').insert({ username, password_hash: hash, full_name: 'TNR Administrator', role: 'superadmin' });
    console.log(`✅ Created new admin "${username}".`);
  }

  const { count } = await sb.from('admin_users').select('*', { count: 'exact', head: true });
  console.log(`\n👉 Login at http://localhost:3000/admin`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log(`   (total admin accounts: ${count})\n`);
  process.exit(0);
})().catch(e => { console.log('❌ Error:', e.message); process.exit(1); });
