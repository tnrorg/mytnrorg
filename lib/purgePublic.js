import 'server-only';
import { revalidatePath } from 'next/cache';

/* Drop the cached copy of a public page after an admin changes what it shows.
 *
 * The home page is rendered on the server with `revalidate = 60`, which is
 * what keeps its Lighthouse score where it is. The cost is that an edit can
 * take up to a minute to appear — and an admin who saves, switches tab, and
 * sees the old version reasonably concludes the save failed. They then save
 * again, which does nothing, and the trust is gone.
 *
 * revalidatePath discards that cached copy immediately, so the next visitor
 * gets a fresh render. The cache still does its job for everyone else.
 *
 * Never throws. A failed purge means a page is briefly stale; it must not turn
 * a successful save into an error the admin has to interpret.
 */
export function purgePublic(...paths) {
  for (const p of ['/', ...paths]) {
    try { revalidatePath(p); } catch { /* stale for up to 60s — not worth failing a save */ }
  }
}
