import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { throttle } from '@/lib/loginGuard';
import {
  normalizeEmail, normalizeMobile, isValidEmail, generateApplicationRef,
} from '@/lib/membership/core';
import { sendApplicationReceived, sendAdminNewApplication } from '@/lib/membership/emails';
import { uploadDataUrl } from '@/lib/storage';
import { hashPassword } from '@/lib/membership/auth';
import { validateApplication, REQUIRED_LABELS, ageFrom } from '@/lib/membership/validateApplication';
import { GENDER_SELF_DESCRIBE, needsReferrer, needsHeardDetail } from '@/lib/membership/options';
import { toNameCase } from '@/lib/membership/nameCase';
import { ROLE_KEYS, roleLabel } from '@/lib/membership/roles';

export const dynamic = 'force-dynamic';

const ACTIVE = ['pending_review', 'under_review', 'correction_requested', 'approved'];

export async function POST(req) {
  const sb = supabaseAdmin();
  const ip = clientIp(req);

  /* Registration is a public write that creates a row, uploads an image and
     sends two emails. Without a limit one script can fill the committee's
     queue and exhaust the daily mail quota.

     TWO THINGS WERE WRONG WITH THE OLD LIMIT, and both locked out real people.

     It counted ATTEMPTS, not applications. It ran before validation, so an
     applicant who mistyped a field, was shown the error and corrected it was
     three tries from a one-hour lockout — punished for filling in a form the
     way people actually fill in forms. It now charges the limit only after an
     application has genuinely been created, below.

     And three per hour is far too few for how registration really happens
     here. Pakistani mobile networks put a great many subscribers behind one
     public address, and members register in groups — one person with a laptop
     helping a dozen others at a gathering is a normal evening's work, and to
     this endpoint it looks like one connection. Twenty completed applications
     an hour still stops a script; a fifteen-minute pause, rather than an
     hour, is a recoverable mistake if a real group ever reaches it. */
  const LIMIT = { max: 20, windowMinutes: 60, lockMinutes: 15 };
  const gate = await throttle('apply', ip, { ...LIMIT, count: false });
  if (gate.blocked) return fail('RATE_LIMITED', 429, {
    message: 'A lot of applications have come from this connection in the last hour. '
      + 'Please wait about 15 minutes and try again — your details have not been lost.' });

  const b = await readJson(req);

  // ── Required fields ──
  /* Tidied on the way in, so the directory, the membership card and the
     certificate all read the same properly-cased name however the applicant
     typed it. See lib/membership/nameCase.js. */
  const first_name = toNameCase(b.first_name);
  const last_name  = toNameCase(b.last_name);
  const email      = normalizeEmail(b.email);
  const mobile     = normalizeMobile(b.mobile);

  // Same rule set the form uses, re-checked here so a direct POST cannot
  // create a half-empty application.
  const errors = validateApplication(b);
  if (Object.keys(errors).length) {
    const names = Object.keys(errors).map(k => REQUIRED_LABELS[k] || k);
    return fail('INCOMPLETE', 400, {
      message: `Please complete every required field: ${names.join(', ')}.`,
      fields: errors,
    });
  }
  if (!isValidEmail(email)) return fail('INVALID', 400, { message: 'Please enter a valid email address.' });

  /* ── Duplicate prevention ──
   *
   * Two separate queries rather than one .or(...).
   *
   * The old version interpolated the email and mobile straight into a
   * PostgREST filter string, where a comma or a parenthesis in the value would
   * change what the filter means. Two plain equality checks cannot be
   * misassembled, and they also tell us WHICH field matched — which the single
   * combined query could not.
   *
   * That distinction is the whole point. The message used to say "these
   * details" for both cases, so an applicant with a brand-new email address
   * whose MOBILE number was already registered was told a membership existed
   * for details they had never used before. They then changed the email again,
   * which of course changed nothing.
   *
   * Naming the field is not a privacy leak: it says a number is registered,
   * not whose it is, and the applicant already knows the number is theirs. */
  const [{ data: byEmail }, { data: byMobile }] = await Promise.all([
    sb.from('membership_applications').select('status').eq('email_normalized', email),
    sb.from('membership_applications').select('status').eq('mobile_normalized', mobile),
  ]);

  const emailClash = (byEmail || []).find(d => ACTIVE.includes(d.status));
  const mobileClash = (byMobile || []).find(d => ACTIVE.includes(d.status));
  const blocking = emailClash || mobileClash;

  if (blocking) {
    const which = emailClash && mobileClash ? 'email address and mobile number'
      : emailClash ? 'email address' : 'mobile number';
    const msg = blocking.status === 'approved'
      ? `That ${which} is already registered to a TNR membership. `
        + 'Please use Member Login, or contact the committee if you think this is a mistake.'
      : `An application using that ${which} is already under review. `
        + 'Please use "Check Application Status" — or use a different one if you are applying for someone else.';
    // `field` lets the form highlight the offending input rather than making
    // the applicant guess which of the two to change.
    return fail('DUPLICATE', 409, {
      message: msg,
      field: emailClash && !mobileClash ? 'email' : (!emailClash ? 'mobile' : null),
    });
  }

  // An approved member may hold either identifier; check both here too, for
  // the same reason.
  const [{ data: memberByEmail }, { data: memberByMobile }] = await Promise.all([
    sb.from('membership_members').select('id').eq('email_normalized', email).is('deleted_at', null).limit(1),
    sb.from('membership_members').select('id').eq('mobile_normalized', mobile).is('deleted_at', null).limit(1),
  ]);
  if (memberByEmail?.length || memberByMobile?.length) {
    const which = memberByEmail?.length && memberByMobile?.length ? 'email address and mobile number'
      : memberByEmail?.length ? 'email address' : 'mobile number';
    return fail('DUPLICATE', 409, {
      message: `That ${which} already belongs to a TNR member. Please use Member Login.`,
      field: memberByEmail?.length && !memberByMobile?.length ? 'email'
        : (!memberByEmail?.length ? 'mobile' : null),
    });
  }

  // ── Profile photo (optional) ──
  // Validated server-side: images only, max ~4 MB decoded.
  let photo_url = null;
  if (b.photo_data) {
    const head = String(b.photo_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_PHOTO', 400, { message: 'Profile photo must be a JPG, PNG or WEBP image.' });
    const approxBytes = (String(b.photo_data).length - head.indexOf(',')) * 0.75;
    if (approxBytes > 4 * 1024 * 1024)
      return fail('PHOTO_TOO_BIG', 400, { message: 'Profile photo must be smaller than 4 MB.' });
    try { photo_url = await uploadDataUrl(b.photo_data, 'members'); }
    catch (e) {
      // The photo is a required field and appears on the membership card, so a
      // failed upload can no longer be swallowed — an application without one
      // would reach the committee incomplete.
      return fail('UPLOAD_FAILED', 502, {
        message: 'Your photo could not be uploaded. Please try a smaller image or a different file.' ,
      });
    }
    if (!photo_url) return fail('UPLOAD_FAILED', 502, {
      message: 'Your photo could not be uploaded. Please try again.' });
  }

  // ── Sign-in password ──
  // Hashed here and never stored or logged in plain form. Carried onto the
  // member record at approval, so no invitation link is needed afterwards.
  const password_hash = await hashPassword(String(b.password));

  // ── Insert (status ALWAYS pending_review — never auto-active) ──
  // The chosen type is recorded as a REQUEST only. The member row — and with
  // it the actual role — is created at approval by an admin, so submitting
  // "advisory" here grants nothing.
  const applied_role = ROLE_KEYS.includes(b.applied_role) ? b.applied_role : 'general';

  // The reference is NOT taken from the sequence yet.
  //
  // Sequences do not roll back, so generating the number before the insert
  // meant every failed submission burned one — that is why the visible
  // references jumped 0009 → 0016. The row goes in with a temporary unique
  // placeholder, and the real number is claimed only once the insert has
  // succeeded, so a failure costs nothing.
  const placeholder = `PENDING-${crypto.randomUUID()}`;
  const row = {
    reference_no: placeholder,
    applied_role,
    first_name, last_name,
    gender: b.gender || null,
    // Stored ONLY when that option was chosen, and trimmed to the same 60
    // characters the validator enforces. Anyone posting straight to this
    // endpoint could otherwise attach free text to "Male" and have it
    // displayed as their gender, or send a paragraph.
    gender_self_described: b.gender === GENDER_SELF_DESCRIBE
      ? (String(b.gender_self_described || '').trim().slice(0, 60) || null)
      : null,
    // Age is derived, never taken from the client — a typed age goes stale and
    // can be inflated to clear the minimum. Both are stored: date_of_birth is
    // the source of truth, age stays populated for anything already reading it.
    date_of_birth: b.date_of_birth || null,
    age: b.date_of_birth ? ageFrom(b.date_of_birth) : null,
    village: b.village || null,
    union_council: b.union_council || null,
    // Where they live now. Name and code both stored — see the migration for
    // why keeping only the readable name is not enough.
    current_country: b.current_country || null,
    current_country_code: b.current_country_code || null,
    current_state_province: b.current_state_province || null,
    current_state_code: b.current_state_code || null,
    current_city: b.current_city || null,
    mobile, mobile_normalized: mobile,
    email, email_normalized: email,
    photo_url,
    password_hash,
    education_level: b.education_level || null,
    // Category and free text kept apart: the category is what the profession
    // statistics group on, so the typed value never lands in that column.
    profession: b.profession || null,
    profession_other: b.profession === 'Other'
      ? (String(b.profession_other || '').trim() || null) : null,
    // The form no longer asks for "Field of Study / Profession" — it duplicated
    // this question. The column stays populated from the profession so the
    // Fields of Study chart, the leadership profile and the member portal keep
    // working for new members instead of going blank for everyone who joins
    // from here on.
    field_of_study: b.profession === 'Other'
      ? (String(b.profession_other || '').trim() || null)
      : (b.profession || null),
    organization_name: String(b.organization_name || '').trim() || null,
    // "Other" is stored as the text the applicant typed, so reports and the
    // directory filter show a real position rather than a bucket label.
    current_position: b.current_position === 'Other'
      ? String(b.position_other || '').trim() || 'Other'
      : (b.current_position || null),
    why_join: String(b.why_join).trim(),
    contribution_areas: b.contribution_areas,
    leadership_view: b.leadership_view,
    leadership_note: b.leadership_note || null,
    youth_issues: String(b.youth_issues).trim(),

    /* Referral source.
     *
     * The follow-up columns are stored only for the option that asks for them.
     * Someone who types a referrer's name, then changes their answer to
     * Facebook, must not leave that name behind on the record — it would show
     * up in the referral counts as a person who referred nobody. The form
     * clears them too; this is the half that a direct POST cannot skip. */
    // validateApplication already rejected anything outside the six options,
    // so this is one of them or the request never reached here.
    heard_about: String(b.heard_about || '').trim() || null,
    heard_about_detail: needsHeardDetail(b.heard_about)
      ? (String(b.heard_about_detail || '').trim() || null) : null,
    referred_by_name: needsReferrer(b.heard_about)
      ? (String(b.referred_by_name || '').trim() || null) : null,

    declaration_accepted: true,
    declaration_version: b.declaration_version || 'v1.0',
    declaration_at: new Date().toISOString(),
    submitted_ip: ip,
    submitted_user_agent: (req.headers.get('user-agent') || '').slice(0, 300),
    whatsapp_opt_in: !!b.whatsapp_opt_in,
    status: 'pending_review',
  };

  const { data, error } = await sb.from('membership_applications').insert(row)
    .select('id, created_at').single();
  if (error) {
    // Unique index race → treat as duplicate, not a server error
    if (error.code === '23505')
      return fail('DUPLICATE', 409, { message: 'An application with these details already exists.' });

    // A missing column means a migration has not been run. Say so plainly —
    // "please try again" is useless advice when retrying cannot possibly work,
    // and it hid this exact problem until someone opened the server logs.
    const missingColumn = /column .* does not exist|schema cache/i.test(error.message || '');
    if (missingColumn) {
      return fail('SCHEMA_OUT_OF_DATE', 500, {
        message: 'The application form is not fully set up yet. Please contact the TNR team.' ,
        hint: 'Run the pending migrations in supabase/ — most likely migration_profession.sql, migration_address_organization.sql, migration_date_of_birth.sql or migration_member_roles.sql.',
      });
    }
    return fail('SUBMIT_FAILED', 500, {
      message: 'Could not submit your application. Please try again.' ,
    });
  }

  /* The application exists. NOW charge the rate limit.
   *
   * Deliberately after the insert: this counts applications created, which is
   * the thing worth limiting, rather than requests received — which included
   * every corrected typo and every duplicate check, and is what was locking
   * real applicants out for an hour.
   *
   * Not awaited into the response path beyond this call, and wrapped: a
   * throttle-bookkeeping failure must never lose an application that is
   * already safely in the table. */
  try {
    await throttle('apply', ip, LIMIT);
  } catch { /* the row is saved; the counter is not worth failing over */ }

  // Insert succeeded — now claim the reference number.
  let reference_no = placeholder;
  try {
    reference_no = await generateApplicationRef();
    const { error: refErr } = await sb.from('membership_applications')
      .update({ reference_no }).eq('id', data.id);
    if (refErr) reference_no = placeholder;   // keep the row; admin can still see it
  } catch { /* the application is saved either way */ }

  await sb.from('membership_status_history').insert({
    to_status: 'pending_review', reason: 'Application submitted', changed_by: 'applicant',
  }).then(() => {}, () => {});

  // Confirmation email — never block submission if the mail server hiccups.
  // Neither email may block the submission — an SMTP hiccup must not lose an
  // application that is already safely stored.
  const saved = { ...row, reference_no };
  try { await sendApplicationReceived(saved); } catch {}
  try { await sendAdminNewApplication(saved, roleLabel(applied_role)); } catch {}

  return ok({
    reference_no,
    submitted_at: data.created_at,
    message: 'Application submitted successfully.',
  });
}
