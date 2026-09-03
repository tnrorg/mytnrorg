import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyWebhook } from '@/lib/livekit';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* LiveKit calls this when a recording finishes.
 *
 * PUBLIC ROUTE, SIGNED PAYLOAD. There is no session behind a webhook, so
 * authenticity comes from the signature LiveKit puts in the Authorization
 * header, checked against the API secret before a single field is believed.
 * Without that check this is an open endpoint where anyone could post "your
 * recording is ready, here is the URL" and have TNR file a link to arbitrary
 * content against an Advisory Council meeting.
 *
 * The raw body is needed for verification, so it is read as text and never
 * parsed first — JSON.parse then re-stringify would not produce the same bytes
 * the signature covers.
 *
 * Configure at LiveKit Cloud → Settings → Webhooks:
 *   https://www.mytnr.org/api/webhooks/livekit
 */
export async function POST(req) {
  const raw = await req.text();
  const auth = req.headers.get('authorization') || '';

  let event;
  try {
    event = await verifyWebhook(raw, auth);
  } catch {
    // Deliberately terse. A caller who cannot sign gets no help learning why.
    return fail('INVALID_SIGNATURE', 401, { message: 'Rejected.' });
  }

  const sb = supabaseAdmin();
  const info = event?.egressInfo;

  // Only egress events matter here; room and participant events are already
  // handled by the app's own join/leave path, which knows about attendance.
  if (!info?.egressId) return ok({ ignored: event?.event || 'unknown' });

  const state = String(info.status ?? '').toUpperCase();
  const finished = state.includes('COMPLETE') || event.event === 'egress_ended';
  const failed = state.includes('FAILED') || state.includes('ABORTED');

  const file = (info.fileResults || [])[0] || info.file || null;

  const patch = {
    status: failed ? 'failed' : finished ? 'ready' : 'processing',
    ...(file?.location || file?.filename
      ? { file_url: file.location || null, file_name: (file.filename || '').split('/').pop() || null }
      : {}),
    ...(file?.size ? { file_size: Number(file.size) } : {}),
    ...(file?.duration ? { duration_seconds: Math.round(Number(file.duration) / 1e9) } : {}),
  };

  const { data: updated } = await sb.from('meeting_recordings')
    .update(patch).eq('provider_egress_id', info.egressId).select('id').maybeSingle();

  /* A row we do not recognise is not an error.
   *
   * Webhooks retry, arrive out of order, and can outlive a meeting that was
   * deleted. Answering 200 stops LiveKit retrying something that will never
   * match; answering 500 would have it retry for hours. */
  return ok({ recorded: !!updated, egress: info.egressId, status: patch.status });
}
