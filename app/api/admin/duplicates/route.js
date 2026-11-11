import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { logMembershipAudit } from '@/lib/membership/core';
import { runDuplicateCheck } from '@/lib/membership/duplicateDetection';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'confirmed_duplicate', 'not_duplicate', 'dismissed'];

/* The fields shown side by side in the review panel.
 *
 * This is the whole point of listing them explicitly rather than selecting
 * everything: an admin comparing two records needs the seven fields the score
 * was computed from, so that is what they get. Mobile numbers, email addresses,
 * photo paths, motivation essays and CNIC columns are not loaded, because
 * resolving "are these the same person" does not require them and a reviewer
 * browsing a queue of strangers' contact details is a different thing from a
 * reviewer checking a match. */
const MEMBER_VIEW =
  'id, membership_id, full_name, village, union_council, education_level, ' +
  'field_of_study, current_position, status, created_at, application_id';
const APP_VIEW =
  'id, reference_no, full_name, village, union_council, age, education_level, ' +
  'field_of_study, current_position, organization_name, status, created_at';

/** Load both sides of each flag in two queries, not two per flag. */
async function hydrate(sb, flags) {
  const memberIds = new Set();
  const appIds = new Set();
  for (const f of flags) {
    (f.left_kind === 'member' ? memberIds : appIds).add(f.left_id);
    (f.right_kind === 'member' ? memberIds : appIds).add(f.right_id);
  }

  const [{ data: members }, { data: apps }] = await Promise.all([
    memberIds.size
      ? sb.from('membership_members').select(MEMBER_VIEW).in('id', [...memberIds])
      : Promise.resolve({ data: [] }),
    appIds.size
      ? sb.from('membership_applications').select(APP_VIEW).in('id', [...appIds])
      : Promise.resolve({ data: [] }),
  ]);

  /* Members have no age or university of their own — both sit on the
     application they were approved from. Fetched in one extra round trip so
     the comparison the admin sees matches the comparison that produced the
     score, rather than showing blanks where the engine saw values. */
  const linked = (members || []).map(m => m.application_id).filter(Boolean)
    .filter(id => !appIds.has(id));
  const { data: linkedApps } = linked.length
    ? await sb.from('membership_applications').select('id, age, organization_name').in('id', linked)
    : { data: [] };
  const linkedById = new Map((linkedApps || []).map(a => [a.id, a]));

  const mById = new Map((members || []).map(m => {
    const src = m.application_id
      ? (linkedById.get(m.application_id)
         || (apps || []).find(a => a.id === m.application_id))
      : null;
    return [m.id, {
      kind: 'member', id: m.id, label: m.membership_id,
      full_name: m.full_name, village: m.village, union_council: m.union_council,
      age: src?.age ?? null, university: src?.organization_name ?? null,
      education: m.education_level, profession: m.field_of_study || m.current_position,
      status: m.status, created_at: m.created_at,
    }];
  }));

  const aById = new Map((apps || []).map(a => [a.id, {
    kind: 'application', id: a.id, label: a.reference_no,
    full_name: a.full_name, village: a.village, union_council: a.union_council,
    age: a.age, university: a.organization_name,
    education: a.education_level, profession: a.field_of_study || a.current_position,
    status: a.status, created_at: a.created_at,
  }]));

  const side = (kind, id) =>
    (kind === 'member' ? mById.get(id) : aById.get(id))
    /* The record was deleted while this flag was still open. Shown as a
       tombstone rather than dropped: a flag whose other half has vanished is
       itself information — usually that somebody already dealt with it. */
    || { kind, id, missing: true };

  return flags.map(f => ({
    ...f,
    left: side(f.left_kind, f.left_id),
    right: side(f.right_kind, f.right_id),
  }));
}

// GET — the review queue.
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);

  const status = url.searchParams.get('status') || 'open';
  if (!STATUSES.includes(status) && status !== 'all')
    return fail('BAD_STATUS', 400, { message: 'Unknown review status.' });

  let q = sb.from('membership_duplicate_flags')
    .select('*').order('score', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('review_status', status);

  const { data, error } = await q;
  if (error) {
    /* A missing table means the migration has not been run. Say which one —
       "could not load" sends an admin to the server logs for something that is
       answerable here. */
    if (/does not exist|schema cache/i.test(error.message || ''))
      return fail('SCHEMA_OUT_OF_DATE', 500, {
        message: 'Duplicate detection is not set up yet.',
        hint: 'Run supabase/migration_duplicate_detection.sql.' });
    return fail('LOAD_FAILED', 500, { message: 'Could not load the duplicate queue.' });
  }

  const flags = await hydrate(sb, data || []);

  // Counts for the filter tabs.
  const { data: all } = await sb.from('membership_duplicate_flags').select('review_status');
  const counts = { open: 0, confirmed_duplicate: 0, not_duplicate: 0, dismissed: 0 };
  for (const r of all || []) if (counts[r.review_status] !== undefined) counts[r.review_status]++;

  return ok({ flags, counts });
}

/* PATCH — record a human verdict on one flag.
 *
 * THIS IS THE ONLY THING THAT RESOLVES A FLAG, and it resolves only the flag.
 *
 * Confirming a duplicate writes a verdict and nothing else: it does not
 * suspend the member, delete the application, merge the two records or alter
 * either of them. Those are real decisions with real consequences for somebody
 * who may simply share a name, and they stay in the hands of an admin using
 * the existing member and application tools, where each one is separately
 * confirmed and separately audited. A similarity score is not permitted to
 * reach through this route and change a membership. */
export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const ip = clientIp(req);

  if (!b.id) return fail('ID_REQUIRED', 400, { message: 'Which flag?' });
  if (!STATUSES.includes(b.review_status))
    return fail('BAD_STATUS', 400, { message: 'Unknown review status.' });
  if (b.review_status === 'open')
    return fail('BAD_STATUS', 400, { message: 'A flag cannot be reopened.' });

  const { data: flag } = await sb.from('membership_duplicate_flags')
    .select('*').eq('id', b.id).maybeSingle();
  if (!flag) return fail('NOT_FOUND', 404, { message: 'Flag not found.' });

  const note = String(b.note || '').trim().slice(0, 1000) || null;
  /* Confirming that two people are the same person is the consequential
     verdict — it is what an admin will later cite when suspending one of the
     two accounts. It does not get to be a bare click. */
  if (b.review_status === 'confirmed_duplicate' && !note)
    return fail('NOTE_REQUIRED', 400, {
      message: 'Record how this was confirmed — who was contacted, or what was checked.' });

  const { error } = await sb.from('membership_duplicate_flags').update({
    review_status: b.review_status,
    reviewed_by: admin.username,
    reviewed_at: new Date().toISOString(),
    review_note: note,
    updated_at: new Date().toISOString(),
  }).eq('id', flag.id);
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not save the review.' });

  // History: kept even when a later admin reverses this.
  await sb.from('membership_duplicate_reviews').insert({
    flag_id: flag.id, from_status: flag.review_status, to_status: b.review_status,
    note, reviewed_by: admin.username, ip,
  }).then(() => {}, () => {});

  await logMembershipAudit({
    admin_name: admin.username, action: 'DUPLICATE_REVIEWED', target_type: 'duplicate_flag',
    target_id: flag.id,
    previous_value: { review_status: flag.review_status },
    new_value: { review_status: b.review_status, score: flag.score },
    reason: note, ip,
  });

  return ok({ updated: true });
}

/* POST — re-run detection for one record, or rescan the whole roll.
 *
 * Needed because the engine improves: a pair that scored 60 under version 1
 * may score 90 under version 2, and without a rescan those pairs stay
 * invisible. Existing reviewed flags are left alone — see the upsert in the
 * service. */
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);

  if (b.kind && b.id) {
    if (!['member', 'application'].includes(b.kind))
      return fail('BAD_KIND', 400, { message: 'Unknown record type.' });
    const r = await runDuplicateCheck({ kind: b.kind, id: b.id });
    return ok(r);
  }

  if (b.rescan !== true)
    return fail('BAD_REQUEST', 400, { message: 'Pass a record, or rescan: true.' });

  /* Full rescan. Every live application against the whole roll.
   *
   * Applications only, not members: every pair is symmetric, and a member is
   * one side of a pair whose other side is scanned anyway, so scanning both
   * would double the work to find the same flags. Capped, and it reports how
   * far it got rather than running until the request times out. */
  const sb = supabaseAdmin();
  const { data: apps } = await sb.from('membership_applications')
    .select('id').in('status', ['pending_review', 'under_review', 'correction_requested'])
    .order('created_at', { ascending: false }).limit(300);

  let scanned = 0, flagged = 0;
  for (const a of apps || []) {
    const r = await runDuplicateCheck({ kind: 'application', id: a.id });
    scanned++; flagged += r.flagged;
  }

  await logMembershipAudit({
    admin_name: admin.username, action: 'DUPLICATE_RESCAN', target_type: 'duplicate_flag',
    target_id: null, previous_value: null, new_value: { scanned, flagged },
    reason: null, ip: clientIp(req),
  });

  return ok({ scanned, flagged, capped: (apps || []).length >= 300 });
}
