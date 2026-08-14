import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { STATUSES } from '@/lib/contact';

export const dynamic = 'force-dynamic';

/** Change a message's status, or add a private note. */
export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);

  const patch = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status))
      return fail('BAD_STATUS', 400, { message: 'Unknown status.' });
    patch.status = b.status;
    patch.handled_by = admin.username;
    patch.handled_at = new Date().toISOString();
  }
  if (b.admin_notes !== undefined) {
    patch.admin_notes = String(b.admin_notes || '').slice(0, 4000);
  }
  if (!Object.keys(patch).length) return ok({ updated: false });

  const { error } = await supabaseAdmin()
    .from('contact_messages').update(patch).eq('id', params.id);
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not update the message.' });

  return ok({ updated: true });
}

/* Deletion is SUPER ADMIN only.
 *
 * These messages include complaints, and a complaint that any admin can make
 * disappear is not a complaints process. Marking something as spam is the
 * everyday action and it is reversible; deletion is not, so it sits behind the
 * higher rank and leaves an audit entry naming who did it.
 */
export async function DELETE(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  if (!isSuperAdmin(admin)) {
    return fail('FORBIDDEN', 403, {
      message: 'Only a Super Admin can delete a message. Mark it as spam instead.',
    });
  }

  const sb = supabaseAdmin();
  const { data: row } = await sb.from('contact_messages')
    .select('kind, subject, name').eq('id', params.id).maybeSingle();

  const { error } = await sb.from('contact_messages').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete the message.' });

  await logAudit({
    action: 'CONTACT_MESSAGE_DELETED',
    actor: admin.username,
    ip: clientIp(req),
    details: row ? `${row.kind}: "${row.subject}" from ${row.name}` : params.id,
  });

  return ok({ deleted: true });
}
