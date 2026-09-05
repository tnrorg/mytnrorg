import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { getActiveElection } from '@/lib/election';
import { sendNotice, fillTokens } from '@/lib/mailer';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const MAX_BATCH = 25; // keep each request inside the serverless time limit

// 'none' means "send only to the addresses I typed" — see the send path.
export const AUDIENCES = ['all', 'not_voted', 'voted', 'candidates', 'portal', 'none'];

/* Registered portal members — the membership system, not the voter roll.
 *
 * These are two different populations and always have been. `members` is who
 * could vote in the election; `membership_members` is who has joined TNR since.
 * A member who registered this month is in the second and not the first, which
 * is why they never received any of these emails.
 *
 * Mapped onto the same shape the voter rows use, so fillTokens and the send
 * loop below do not need to know which table a recipient came from —
 * {{name}}, {{member_code}} and {{village}} work for both.
 */
async function portalRecipients() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('membership_members')
    .select('id, full_name, membership_id, village, email, status, deleted_at')
    .is('deleted_at', null);
  if (error) { const e = new Error('membership_members query failed: ' + error.message); e.dbError = true; throw e; }

  const LIVE = ['active', 'approved'];
  return (data || [])
    .filter(m => LIVE.includes(String(m.status || '').trim().toLowerCase()))
    .map(m => ({
      id: m.id,
      full_name: m.full_name,
      member_code: m.membership_id,      // token name the composer already uses
      village: m.village,
      email: String(m.email || '').trim(),
      source: 'portal',
    }))
    .filter(m => m.email.includes('@'));
}

/** Loose address check — enough to catch a typo, not a full RFC parser. */
export const looksLikeEmail = (v) =>
  /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(String(v || '').trim());

/** Free-typed addresses, for people who are in neither table. */
export function parseExtraEmails(raw) {
  return [...new Set(
    String(raw || '')
      .split(/[\s,;\n]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  )];
}

// Returns the recipient list for the chosen audience (approved members with an email).
async function recipients(audience, election, member_ids) {
  const sb = supabaseAdmin();
  // The portal audience comes from a different table entirely and shares none
  // of the voting filters below.
  if (audience === 'portal') return portalRecipients();
  // select('*') so a missing optional column can never blank the whole query
  const { data: members, error: memErr } = await sb.from('members').select('*');
  if (memErr) { const e = new Error('members query failed: ' + memErr.message); e.dbError = true; throw e; }
  // Status match is case-insensitive so 'approved' / 'APPROVED' still count.
  let list = (members || [])
    .filter(m => String(m.status || '').trim().toLowerCase() === 'approved')
    .map(m => ({ ...m, email: String(m.email || '').trim() }))
    .filter(m => m.email.includes('@'));

  // Hand-picked recipients (from the admin's member search) override everything.
  if (Array.isArray(member_ids) && member_ids.length) {
    const chosen = new Set(member_ids);
    return list.filter(m => chosen.has(m.id));
  }

  if (audience === 'candidates') {
    if (!election) return [];
    const { data: cands } = await sb.from('candidates')
      .select('name, status').eq('election_id', election.id);
    const names = new Set((cands || [])
      .filter(c => c.status === 'Active')
      .map(c => String(c.name || '').trim().toLowerCase()));
    return list.filter(m => names.has(String(m.full_name || '').trim().toLowerCase()));
  }

  if (!election || audience === 'all') return list;

  if (audience === 'voted' || audience === 'not_voted') {
    const { data: votes } = await sb.from('votes').select('member_id').eq('election_id', election.id);
    const voted = new Set((votes || []).map(v => v.member_id));
    list = list.filter(m => audience === 'voted' ? voted.has(m.id) : !voted.has(m.id));
  }
  return list;
}

// GET → audience counts so the admin can preview before sending
export async function GET(req) {
  const { res } = await requireAdmin(req);
  if (res) return res;
  try {
  const election = await getActiveElection();
  const [all, notVoted, voted, candidates, portal] = await Promise.all([
    recipients('all', election), recipients('not_voted', election),
    recipients('voted', election), recipients('candidates', election),
    // Never let a missing membership table take down the whole panel — the
    // election audiences must still work if this one cannot be read.
    recipients('portal', election).catch(() => []),
  ]);
  // Diagnostics so a zero count explains itself in the UI
  const sb = supabaseAdmin();
  const { data: raw, error: rawErr } = await sb.from('members').select('*');
  if (rawErr) return fail('DB_ERROR', 500, { message: 'Could not read members table.', detail: rawErr.message });
  const rows = raw || [];
  const sample = rows[0] ? Object.keys(rows[0]) : [];
  const approved = rows.filter(m => String(m.status || '').trim().toLowerCase() === 'approved');
  const noEmail = approved.filter(m => !String(m.email || '').trim().includes('@')).length;
  const statuses = {};
  rows.forEach(m => { const k = String(m.status || '(blank)').trim(); statuses[k] = (statuses[k] || 0) + 1; });

  // Small directory for the recipient search box (names only, no email addresses).
  const { data: dir } = await sb.from('members')
    .select('id, full_name, member_code, village, email, status').order('full_name').limit(2000);
  const members_directory = (dir || [])
    .filter(m => String(m.status || '').trim().toLowerCase() === 'approved')
    .map(m => ({ id: m.id, full_name: m.full_name, member_code: m.member_code, village: m.village, has_email: !!String(m.email || '').trim().includes('@') }));

  return ok({
    members_directory,
    election: election ? { id: election.id, title: election.title, voting_open: !!election.voting_open } : null,
    counts: {
      all: all.length, not_voted: notVoted.length, voted: voted.length,
      candidates: candidates.length, portal: portal.length, missing_email: noEmail,
    },
    diagnostics: { total_members: rows.length, approved: approved.length, statuses, columns: sample, has_email_column: sample.includes('email') },
    smtp_configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  });
  } catch (e) {
    return fail('DIAG_FAILED', 500, { message: 'Could not build recipient list.', detail: e.message });
  }
}

// POST → send one batch. The client loops with `offset` until done:true.
export async function POST(req) {
  const { admin, res } = await requireAdmin(req);
  if (res) return res;
  const b = await readJson(req);
  const subject = String(b.subject || '').trim();
  const message = String(b.message || '').trim();
  const heading = String(b.heading || '').trim();
  const audience = AUDIENCES.includes(b.audience) ? b.audience : 'not_voted';
  const offset = Math.max(0, Number(b.offset || 0));
  const ip = clientIp(req);

  if (!subject || !message)
    return fail('INVALID', 400, { message: 'Subject and message are both required.' });

  const election = await getActiveElection();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  /* The "Cast Your Vote" button belongs to election audiences only.
   *
   * Portal members and typed-in addresses may have no vote to cast — several
   * joined after the election — so the button is OFF by default for them and
   * only appears if the admin ticks it deliberately. Mailing someone outside
   * the organisation a link telling them to vote is worse than no button. */
  const electionAudience = ['all', 'not_voted', 'voted', 'candidates'].includes(audience);
  const wantButton = b.include_button === true
    || (b.include_button !== false && electionAudience);
  const ctaUrl = wantButton ? `${origin}/vote` : null;
  const ctaText = 'Cast Your Vote';

  // Test send — one email to the admin, nothing recorded against members.
  if (b.test_email) {
    try {
      await sendNotice({
        to: String(b.test_email).trim(), subject: `[TEST] ${subject}`, heading,
        body: fillTokens(message, { full_name: 'Test Member', member_code: 'TNR-000' }),
        ctaText: ctaUrl ? ctaText : null, ctaUrl,
      });
      return ok({ test: true, sent: 1 });
    } catch (e) {
      return fail('SEND_FAILED', 502, { message: 'Test email failed.', detail: e.message });
    }
  }

  const member_ids = Array.isArray(b.member_ids) ? b.member_ids : null;
  const extra = parseExtraEmails(b.extra_emails);
  const badExtra = extra.filter(e => !looksLikeEmail(e));
  if (badExtra.length)
    return fail('BAD_EMAIL', 400, {
      message: `That does not look like a valid address: ${badExtra.slice(0, 3).join(', ')}`,
    });

  /* Typed-in addresses REPLACE the audience when no audience list is wanted,
   * and are appended when one is.
   *
   * The composer sends `audience: 'none'` for the first case — someone writing
   * to two people outside the organisation should not have to worry that a
   * highlighted button in the corner is also mailing 375 members. Nothing
   * silently widens who receives a message. */
  const audienceList = audience === 'none' ? [] : await recipients(audience, election, member_ids);

  /* Deduplicate by address.
   *
   * A person can be in the voter roll AND the portal AND typed in by hand —
   * three rows, one inbox. Without this they get the same message three times
   * and the send count reported back is wrong. */
  const seen = new Set();
  const all = [];
  for (const m of [...audienceList, ...extra.map(e => ({ email: e, source: 'typed' }))]) {
    const key = String(m.email || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(m);
  }

  if (!all.length)
    return fail('NO_RECIPIENTS', 400, {
      message: 'No one to send to. Choose an audience, pick members, or type an address.',
    });

  const batch = all.slice(offset, offset + MAX_BATCH);
  if (!batch.length)
    return ok({ done: true, total: all.length, sent: 0, failed: 0, next_offset: offset, errors: [] });

  let sent = 0; const errors = [];
  for (const m of batch) {
    try {
      await sendNotice({
        to: m.email, subject, heading,
        body: fillTokens(message, m),
        ctaText: ctaUrl ? ctaText : null, ctaUrl,
      });
      sent++;
    } catch (e) {
      errors.push(`${m.email}: ${e.message}`);
    }
  }

  const next_offset = offset + batch.length;
  const done = next_offset >= all.length;

  await logAudit({
    action: 'REMINDER_EMAIL_SENT', actor: admin?.username || 'admin',
    details: `${audience}${extra.length ? ` +${extra.length} typed` : ''} · ${sent} sent, `
      + `${errors.length} failed (${offset + 1}-${next_offset} of ${all.length}) · "${subject}"`,
    election_id: election?.id || null, ip,
  });

  return ok({ done, total: all.length, sent, failed: errors.length, next_offset, errors: errors.slice(0, 5) });
}
