import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { mustEnrol } from '@/lib/admin2fa';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

// The client never decides its own role. The server verifies the signed token,
// re-reads the CURRENT role from the database, and returns the extra tabs only
// to a genuine Super Admin. A normal admin's response contains no trace of them.
export async function GET(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  const { data: row } = await sb.from('admin_users')
    .select('id, username, full_name, role, totp_enabled, totp_secret_enc')
    .eq('id', admin.sub).maybeSingle();
  if (!row) return ok({ username: admin.username, full_name: null, extra_tabs: [] });

  const superUser = isSuperAdmin({ role: row.role });
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
    // Labels live on the server — a normal admin never downloads these strings.
    extra_tabs: superUser
      ? [['committee', 'Committee Vote Entry', '🔐'], ['voterdata', 'Voter Data', '🗃️'],
         ['visitors', 'Visitors', '👁️'], ['admins', 'Admin Accounts', '🛡️']]
      : [],
  });
}
