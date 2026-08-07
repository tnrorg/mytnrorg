/**
 * TNR — copy every file in a Storage bucket from the OLD Supabase project
 * to the NEW one. Run once, after the database data has been restored.
 *
 *   Windows (PowerShell):
 *     $env:OLD_URL="https://oldref.supabase.co"
 *     $env:OLD_KEY="old-service-role-key"
 *     $env:NEW_URL="https://newref.supabase.co"
 *     $env:NEW_KEY="new-service-role-key"
 *     node scripts/migrate-storage.js
 *
 *   macOS/Linux:
 *     OLD_URL=... OLD_KEY=... NEW_URL=... NEW_KEY=... node scripts/migrate-storage.js
 *
 * Optional: BUCKET=tnr-media (default), DRY_RUN=1 to list without copying.
 */
const { createClient } = require('@supabase/supabase-js');

const OLD_URL = process.env.OLD_URL;
const OLD_KEY = process.env.OLD_KEY;
const NEW_URL = process.env.NEW_URL;
const NEW_KEY = process.env.NEW_KEY;
const BUCKET = process.env.BUCKET || 'tnr-media';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('\n❌ Missing env vars. Need OLD_URL, OLD_KEY, NEW_URL, NEW_KEY.\n');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldSb = createClient(OLD_URL, OLD_KEY, opts);
const newSb = createClient(NEW_URL, NEW_KEY, opts);

/** Recursively list every file path under `prefix`. */
async function listAll(sb, prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`list("${prefix}"): ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back with a null id.
      if (item.id === null) {
        out.push(...(await listAll(sb, path)));
      } else {
        out.push({ path, size: item.metadata?.size ?? 0, type: item.metadata?.mimetype });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

(async () => {
  console.log(`\n=== TNR storage migration — bucket "${BUCKET}" ===`);
  console.log(`  from ${OLD_URL}`);
  console.log(`    to ${NEW_URL}`);
  if (DRY_RUN) console.log('  (DRY RUN — nothing will be written)\n');

  // Make sure the destination bucket exists and is public.
  const { data: buckets, error: bErr } = await newSb.storage.listBuckets();
  if (bErr) {
    console.error(`\n❌ Cannot reach NEW project storage: ${bErr.message}\n`);
    process.exit(1);
  }
  if (!buckets.some((b) => b.name === BUCKET)) {
    if (DRY_RUN) {
      console.log(`⚠️  Bucket "${BUCKET}" does not exist on NEW project (would create it).`);
    } else {
      const { error } = await newSb.storage.createBucket(BUCKET, { public: true });
      if (error) {
        console.error(`\n❌ Could not create bucket "${BUCKET}": ${error.message}\n`);
        process.exit(1);
      }
      console.log(`✅ Created public bucket "${BUCKET}" on NEW project.`);
    }
  }

  console.log('\nListing files on OLD project…');
  const files = await listAll(oldSb);
  console.log(`Found ${files.length} file(s).\n`);

  if (files.length === 0) {
    console.log('Nothing to copy.\n');
    process.exit(0);
  }

  let done = 0;
  let failed = 0;
  const errors = [];

  for (const f of files) {
    const label = `[${done + failed + 1}/${files.length}] ${f.path}`;

    if (DRY_RUN) {
      console.log(`${label}  (${f.size} bytes)`);
      done++;
      continue;
    }

    try {
      const { data: blob, error: dlErr } = await oldSb.storage.from(BUCKET).download(f.path);
      if (dlErr) throw new Error(`download: ${dlErr.message}`);

      const buffer = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await newSb.storage.from(BUCKET).upload(f.path, buffer, {
        contentType: f.type || blob.type || 'application/octet-stream',
        upsert: true,
      });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      done++;
      console.log(`${label}  ✅ ${buffer.length} bytes`);
    } catch (e) {
      failed++;
      errors.push({ path: f.path, message: e.message });
      console.log(`${label}  ❌ ${e.message}`);
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`  copied: ${done}`);
  console.log(`  failed: ${failed}`);

  if (errors.length) {
    console.log('\nFailures:');
    for (const e of errors) console.log(`  - ${e.path}: ${e.message}`);
  }

  console.log(
    '\nNext: rewrite the stored URLs in the database — see step 5 of MIGRATE-SUPABASE.md\n'
  );
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\n❌ Fatal:', e.message, '\n');
  process.exit(1);
});
