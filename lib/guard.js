import { getAdmin } from '@/lib/auth';
import { fail } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requirementFor, satisfies, ANY, SUPER } from '@/lib/adminScopes';

/** Path of the request being served, however the runtime hands it to us. */
function pathOf(req) {
  try { return req?.nextUrl?.pathname || new URL(req.url).pathname; }
  catch { return ''; }
}

/* Permission-area check, applied to EVERY admin route from one place.
 *
 * requireAdmin is already called by all 75 admin routes, so putting the check
 * here covers them without editing each one — and, more importantly, covers
 * any route added later by default. The alternative, a per-route call, is only
 * as good as the memory of whoever adds the next route, and a route that
 * forgets it is not broken in any visible way. It just quietly has no
 * permissions at all.
 *
 * An unmapped path is REFUSED. A new admin route will therefore fail the first
 * time it is opened, with a message naming the fix, rather than shipping with
 * no restriction on it.
 */
function scopeCheck(req, admin) {
  const path = pathOf(req);
  const need = requirementFor(path);

  if (need === null) {
    return fail('SCOPE_UNMAPPED', 403, {
      message: 'This admin route has no permission area assigned. ' +
        'Add it to ROUTE_SCOPES in lib/adminScopes.js.',
    });
  }
  if (satisfies(admin, need)) return null;

  if (need === SUPER) {
    return fail('FORBIDDEN', 403, {
      message: 'You do not have permission to access this resource.',
    });
  }
  return fail('SCOPE_FORBIDDEN', 403, {
    message: 'Your admin account does not have access to this area. ' +
      'A Super Admin can grant it under Admin Accounts.',
  });
}


/* ── Session revocation ───────────────────────────────────────────────────
 *
 * The token says which epoch it was minted in; the database says which epoch
 * is current. If the database has moved on, the token is dead.
 *
 * THIS COSTS ONE INDEXED LOOKUP PER ADMIN REQUEST, and that is a deliberate
 * trade. Scopes are carried in the token precisely to avoid a read — but a
 * scope going stale for twelve hours is an inconvenience, whereas a session
 * that cannot be revoked for twelve hours is the thing you need most on the
 * one day it matters. Admin traffic is a few office bearers, not the public.
 *
 * IT FAILS CLOSED. If the epoch cannot be read, the request is refused rather
 * than waved through. A Supabase blip already breaks every admin screen, since
 * they all read data — so failing closed costs almost nothing extra, while
 * failing open would mean a revoked session works during exactly the outage an
 * attacker would wait for.
 */
async function epochOk(admin) {
  const tokenEpoch = Number(admin?.epoch ?? 0);
  if (!admin?.sub) return { ok: false, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };

  const { data, error } = await supabaseAdmin()
    .from('admin_users').select('session_epoch').eq('id', admin.sub).maybeSingle();

  /* The column arrives in migration_admin_password.sql. Until that has run the
   * select fails, and we must not lock every admin out of the panel over a
   * migration — so a MISSING COLUMN is tolerated, while a missing ACCOUNT or a
   * real read failure is not. The two are told apart by the error code rather
   * than by guessing. */
  if (error) {
    const missingColumn = /session_epoch/.test(error.message || '')
      || error.code === '42703';
    if (missingColumn) return { ok: true, res: null };
    return { ok: false, res: fail('SESSION_UNVERIFIED', 503, {
      message: 'Could not verify your session. Please try again in a moment.',
    }) };
  }

  // The account was deleted while its token was still valid.
  if (!data) {
    return { ok: false, res: fail('UNAUTHORIZED', 401, { message: 'This admin account no longer exists.' }) };
  }

  if (Number(data.session_epoch ?? 0) > tokenEpoch) {
    return { ok: false, res: fail('SESSION_REVOKED', 401, {
      message: 'You have been signed out because the password on this account was changed. '
        + 'Please sign in again.',
    }) };
  }
  return { ok: true, res: null };
}

/* ASYNC — every call site MUST await it.
 *
 * Destructuring a Promise gives `{ admin: undefined, res: undefined }`, and a
 * route that then writes `if (res) return res` would proceed with NO
 * authentication at all. Every one of the 138 call sites was converted when
 * this became async, and scripts/check-guard-await.js fails the build if a
 * single unawaited call is ever reintroduced. Do not remove that check. */
export async function requireAdmin(req) {
  const admin = getAdmin(req);
  if (!admin) return { admin: null, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };
  const denied = scopeCheck(req, admin);
  if (denied) return { admin, res: denied };
  const live = await epochOk(admin);
  if (!live.ok) return { admin, res: live.res };
  return { admin, res: null };
}

export async function requireSuperAdmin(req) {
  const admin = getAdmin(req);
  if (!admin) return { admin: null, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };
  const role = admin.role;
  if (role !== 'super_admin' && role !== 'superadmin')
    return { admin, res: fail('FORBIDDEN', 403, { message: 'You do not have permission to access this resource.' }) };

  /* Super admin powers require a second factor, enforced here rather than only
   * in the UI.
   *
   * These are the routes that read every member record, edit roles and manage
   * other admin accounts. A password alone should not reach them. The client
   * shows an enrolment wizard for the same condition, but that is a courtesy —
   * this is the control, and it applies to a hand-crafted request just as much
   * as to the panel.
   *
   * 428 rather than 403: the caller is who they claim to be, they have simply
   * not satisfied a precondition yet. The message says how to fix it, because
   * an admin locked out with "forbidden" and no explanation files a bug. */
  if (admin.tfa !== true)
    return { admin, res: fail('TWO_FACTOR_REQUIRED', 428, {
      message: 'Super admin actions require two-factor authentication. ' +
        'Open My Security to set it up, then sign in again.',
      enrolRequired: true,
    }) };

  // Same revocation check as requireAdmin. A super admin's session is the one
  // that most needs to be withdrawable.
  const live = await epochOk(admin);
  if (!live.ok) return { admin, res: live.res };

  return { admin, res: null };
}
export function isSuperAdmin(admin) { return admin?.role === 'super_admin' || admin?.role === 'superadmin'; }

/** Areas this token holds. Super admins hold every area implicitly. */
export function scopesOf(admin) {
  if (isSuperAdmin(admin)) return 'ALL';
  return Array.isArray(admin?.scopes) ? admin.scopes : [];
}

/** Convenience for routes that serve several areas from one endpoint. */
export function hasScope(admin, scope) {
  if (isSuperAdmin(admin)) return true;
  return Array.isArray(admin?.scopes) && admin.scopes.includes(scope);
}

export { ANY, SUPER };
