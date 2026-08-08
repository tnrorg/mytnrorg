import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyMemberToken } from '@/lib/membership/auth';
import { ok, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Record a profile view.
 *
 *   POST { membership_id, seconds }
 *
 * Called once when the reader leaves the page, carrying how long they stayed —
 * not on arrival. Recording on arrival then patching the duration would double
 * the writes and leave a half-row behind whenever the second call is lost.
 *
 * The viewer is identified only from a valid member token. A signed-out visitor
 * is stored as an anonymous view rather than guessed at from an IP address.
 *
 * Always returns ok: analytics must never surface an error to a reader.
 */
const MAX_SECONDS = 3600;   // an hour-long "view" is a forgotten tab, not reading

export async function POST(req) {
  try {
    const b = await readJson(req);
    const viewed = String(b.membership_id || '').trim().toUpperCase();
    if (!/^TNR-MN-\d+$/.test(viewed)) return ok({ recorded: false });

    const seconds = Math.max(0, Math.min(MAX_SECONDS, Math.round(Number(b.seconds) || 0)));
    // Under two seconds is a mis-click or a bounce, not a visit worth logging.
    if (seconds < 2) return ok({ recorded: false });

    const sb = supabaseAdmin();

    // Who is looking, if anyone is signed in.
    let viewer = null;
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const payload = verifyMemberToken(token);
      if (payload?.sub) {
        const { data } = await sb.from('membership_members')
          .select('id, membership_id').eq('id', payload.sub).maybeSingle();
        if (data) viewer = data;
      }
    }

    // Nobody needs a log of someone reading their own page.
    if (viewer?.membership_id === viewed) return ok({ recorded: false });

    const { data: target } = await sb.from('membership_members')
      .select('id').eq('membership_id', viewed).maybeSingle();

    await sb.from('profile_views').insert({
      viewed_member_id: target?.id || null,
      viewed_membership_id: viewed,
      viewer_member_id: viewer?.id || null,
      viewer_membership_id: viewer?.membership_id || null,
      seconds,
      ended_at: new Date().toISOString(),
      user_agent: (req.headers.get('user-agent') || '').slice(0, 200),
    });

    return ok({ recorded: true });
  } catch {
    return ok({ recorded: false });
  }
}
