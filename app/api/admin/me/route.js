import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { mustEnrol } from '@/lib/admin2fa';
import { ok } from '@/lib/api';
import { ALL_SCOPES, cleanScopes } from '@/lib/adminScopes';

export const dynamic = 'force-dynamic';

// The client never decides its own role. The server verifies the signed token,
// re-reads the CURRENT role from the database, and returns the extra tabs only
// to a genuine Super Admin. A normal admin's response contains no trace of them.
export async function GET(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  /* Read `scopes` separately so a panel still loads if the migration has not
   * been run yet. Postgres rejects the entire select for one unknown column,
   * which would lock every admin out of the panel rather than degrade — the
   * same trap that once replaced the home page carousel with the fallback
   * hero. Missing column ⇒ treat as full access, which is what the account
   * actually has until the migration adds the restriction. */
  const BASE = 'id, username, full_name, role, totp_enabled, totp_secret_enc';
  let { data: row } = await sb.from('admin_users')
    .select(`${BASE}, scopes`).eq('id', admin.sub).maybeSingle();
  let scopesColumnMissing = false;
  if (!row) {
    const retry = await sb.from('admin_users').select(BASE).eq('id', admin.sub).maybeSingle();
    row = retry.data;
    scopesColumnMissing = !!row;
  }
  if (!row) return ok({ username: admin.username, full_name: null, extra_tabs: [] });

  const superUser = isSuperAdmin({ role: row.role });
  /* Read live from the database, not from the token.
   *
   * The token's copy can be up to twelve hours stale, and the sidebar is the
   * one place where that would be visible as a tab that appears to work and
   * then refuses. Showing the current answer here means a narrowed admin sees
   * the tab disappear on their next page load, even though the server would
   * have refused it either way. */
  const scopes = superUser ? ALL_SCOPES
    : (scopesColumnMissing ? ALL_SCOPES : cleanScopes(row.scopes));
  return ok({
    username: row.username,
    full_name: row.full_name,
    label: superUser ? 'Super Admin' : 'Control Panel',
    // Re-evaluated on every poll, so a token issued before the requirement
    // existed still meets it. `?? false` covers the window before the 2FA
    // migration has been run, when these columns do not exist yet.
    enrol_required: mustEnrol(row) ?? false,
    // Screens that gate an action on rank read this so they can explain why a
    // button is missing, instead of offering it and letting the server refuse.
    // The server still enforces the rule — this only shapes the UI.
    is_super: superUser,
    // Which parts of the panel this account may open. The sidebar hides the
    // rest; the server refuses them regardless.
    scopes,
    // True when the signed-in token predates a permission change, so the panel
    // can say "sign in again" instead of leaving someone confused by a tab
    // that is visible but refuses to load.
    scopes_stale: !superUser && !scopesColumnMissing
      && JSON.stringify([...scopes].sort())
         !== JSON.stringify([...(Array.isArray(admin.scopes) ? admin.scopes : [])].sort()),
    // Labels live on the server — a normal admin never downloads these strings.
    extra_tabs: superUser
      ? [['committee', 'Committee Vote Entry', '🔐'], ['voterdata', 'Voter Data', '🗃️'],
         ['visitors', 'Visitors', '👁️'], ['admins', 'Admin Accounts', '🛡️']]
      : [],
  });
}
