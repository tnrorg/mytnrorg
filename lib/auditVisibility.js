// Which audit entries a NORMAL admin may see.
// Super Admin activity is private: normal admins must not see what a Super Admin did.
import { supabaseAdmin } from './supabaseServer';

export const SUPER_ONLY_ACTIONS = [
  'COMMITTEE_VOTE_ENTRY',
  'ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_DELETED',
];

// Usernames of every Super Admin — their actions stay hidden from normal admins.
export async function superAdminActors() {
  const { data } = await supabaseAdmin().from('admin_users').select('username, role');
  return new Set((data || [])
    .filter(a => a.role === 'super_admin' || a.role === 'superadmin')
    .map(a => String(a.username || '').toLowerCase()));
}

// Filter a list of audit rows down to what a normal admin is allowed to see.
export function filterForNormalAdmin(rows, superActors) {
  return (rows || []).filter(r => {
    if (SUPER_ONLY_ACTIONS.includes(r.action)) return false;
    const actor = String(r.actor || '').toLowerCase();
    if (superActors.has(actor)) return false;
    return true;
  });
}
