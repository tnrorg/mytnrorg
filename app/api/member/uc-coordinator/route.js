import { requireMember } from '@/lib/membership/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import {
  validateApplication, snapshotFrom, missingDetails,
  COMMITMENT_TEXT, MOTIVATION_MAX,
} from '@/lib/ucCoordinator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_uc_coordinator.sql.';

/* Applying to be a Union Council Coordinator.
 *
 * THE ACCESS RULE, in one line and enforced in one place:
 *
 *     the member id comes from the session token, and from nowhere else.
 *
 * There is no member_id parameter on either verb. The organisation's decision
 * was that only existing members may apply, and "existing member" is exactly
 * what requireMember establishes — so eligibility and identity are the same
 * check, and there is no second one to forget.
 *
 * WHAT THE BROWSER IS ALLOWED TO SEND
 *
 * Two things: the motivation answer, and whether the commitment box is ticked.
 * Everything else on the form — name, membership number, Union Council,
 * addresses, WhatsApp, email, education, profession — is read from the
 * membership record ON THE SERVER and written from there. The form displays
 * those values; it does not submit them. A form that posts its own
 * "membership_id" is a form where the applicant picks their membership number,
 * and a committee would have no way to see it had happened.
 */

/** The open round, if there is one. Draft rounds are invisible to members. */
async function openRound(sb) {
  const { data, error } = await sb.from('uc_coordinator_rounds')
    .select('*').eq('status', 'open').maybeSingle();
  return { round: data || null, error };
}

/* The profile row that tops up the snapshot.
 *
 * The membership record itself is NOT re-read: requireMember already selected
 * the whole row and handed it back, so reading it again would be a second
 * round trip for the same data — and, worse, a second copy that could differ
 * from the one the guard checked.
 *
 * The profile row is optional. Plenty of members have never opened the profile
 * page, so an absent row is normal and the snapshot falls back to the
 * membership record for WhatsApp and city. */
async function profileFor(sb, memberId) {
  const { data } = await sb.from('member_profiles')
    .select('whatsapp, city, address').eq('member_id', memberId).maybeSingle();
  return data || {};
}

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();

  const { round, error: rErr } = await openRound(sb);
  if (rErr) {
    /* Say the table is missing rather than reporting "no round open".
     *
     * Those two look identical to a member — an empty page — but one is a
     * migration nobody has run and the other is the committee not having
     * opened the call yet. Reporting the second when it is the first is how a
     * platform gets described as broken with nobody able to say why. */
    const missing = /uc_coordinator_rounds/.test(rErr.message || '') || rErr.code === '42P01';
    return fail('NOT_READY', 503, {
      message: missing
        ? 'Coordinator applications are not switched on yet.'
        : 'Could not check whether applications are open.',
      detail: missing ? HINT : String(rErr.message || '').slice(0, 160),
    });
  }

  const snapshot = snapshotFrom(member, await profileFor(sb, member.id));

  /* Their own application for THIS round, if they have made one. Scoped by
   * member id from the token as well as round — never by an id from the
   * request. */
  let mine = null;
  if (round) {
    const { data } = await sb.from('uc_coordinator_applications')
      .select('*').eq('round_id', round.id).eq('member_id', member.id).maybeSingle();
    mine = data || null;
  }

  return ok({
    round,
    snapshot,
    /* Which of the four review-critical details are blank on their record, so
     * the page can point them at the right place to fix it BEFORE they apply
     * rather than after the committee cannot process it. */
    missing: missingDetails(snapshot),
    application: mine,
    commitment_text: COMMITMENT_TEXT,
  });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();

  const { round, error: rErr } = await openRound(sb);
  if (rErr || !round) {
    return fail('CLOSED', 409, {
      message: 'Applications are not open at the moment.',
      detail: rErr ? HINT : undefined,
    });
  }

  /* The deadline is checked on the SERVER against the server's clock.
   *
   * The page hides the form after the closing date, but a browser's clock is
   * whatever the person set it to, and the page is not the thing that decides
   * — a late application accepted because a laptop was set to last week is
   * unfair to everyone who respected the date. */
  if (round.closes_on) {
    const end = new Date(`${round.closes_on}T23:59:59+05:00`).getTime();
    if (Number.isFinite(end) && Date.now() > end) {
      return fail('CLOSED', 409, {
        message: `Applications closed on ${round.closes_on}.`,
      });
    }
  }

  /* No membership-status check here.
   *
   * requireMember has already refused anyone who is suspended, inactive or
   * expired — those statuses cannot hold a session at all (LOGIN_STATUSES in
   * lib/membership/auth.js). Repeating the check would be a second copy of the
   * rule that can drift from the first, and the first is the one that governs
   * every other member route. */
  const snapshot = snapshotFrom(member, await profileFor(sb, member.id));
  const gaps = missingDetails(snapshot);
  if (gaps.length) {
    return fail('PROFILE_INCOMPLETE', 400, {
      message: 'Some details are missing from your membership record. '
             + 'Please ask the committee to complete them before you apply.',
      missing: gaps,
    });
  }

  const b = await readJson(req);
  const form = {
    motivation: String(b?.motivation || '').trim().slice(0, MOTIVATION_MAX),
    commitment_accepted: !!b?.commitment_accepted,
  };

  const errors = validateApplication(form);
  if (Object.keys(errors).length) {
    return fail('INVALID', 400, { message: 'Please check the highlighted fields.', errors });
  }

  /* A readable reference for the applicant, allocated from a sequence.
   *
   * If the RPC is unavailable the application is still saved — a missing
   * reference number is a cosmetic loss, and refusing a submission over one
   * would throw away the thing that actually matters. */
  let reference_no = null;
  try {
    /* nextval_text, not nextval — this project wraps the sequence in a
     * SECURITY DEFINER function of its own (migration_membership_phase1.sql)
     * and revokes it from anon and authenticated, so only the server can draw
     * a number. The parameter is `seq_name`; calling PostgREST's built-in
     * would just fail. */
    const { data: n } = await sb.rpc('nextval_text', { seq_name: 'uc_coordinator_seq' });
    if (n != null) reference_no = `TNR-UCC-${String(Number(n)).padStart(4, '0')}`;
  } catch { /* cosmetic only — never block a submission over a label */ }

  const { data, error } = await sb.from('uc_coordinator_applications').insert({
    round_id: round.id,
    member_id: member.id,
    reference_no,
    ...snapshot,
    motivation: form.motivation,
    commitment_accepted: true,
    /* The wording as it stands today, stored with the tick. See the migration:
     * a boolean alone would re-attribute next year's wording to this year's
     * applicants. */
    commitment_text: COMMITMENT_TEXT,
    submitted_at: new Date().toISOString(),
  }).select('*').maybeSingle();

  if (error) {
    /* 23505 is the unique index doing its job: this member already applied to
     * this round. It is the expected outcome of a double-tap on Submit, not a
     * fault, so it gets a plain sentence rather than a failure. */
    if (error.code === '23505' || /uc_apps_once/.test(error.message || '')) {
      const { data: existing } = await sb.from('uc_coordinator_applications')
        .select('*').eq('round_id', round.id).eq('member_id', member.id).maybeSingle();
      return ok({
        application: existing || null,
        duplicate: true,
        message: 'You have already applied for this round.',
      });
    }
    const missing = /uc_coordinator_applications/.test(error.message || '') || error.code === '42P01';
    return fail('SAVE_FAILED', 500, {
      message: missing
        ? 'Coordinator applications are not switched on yet.'
        : 'Your application could not be saved.',
      detail: missing ? HINT : String(error.message || '').slice(0, 160),
    });
  }

  return ok({
    application: data,
    message: 'Your application has been submitted.',
  });
}
