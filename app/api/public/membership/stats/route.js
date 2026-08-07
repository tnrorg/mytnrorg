import { getActiveMemberCount } from '@/lib/membership/core';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// THE single public source for the member count used across the whole site.
export async function GET() {
  return ok({ active_members: await getActiveMemberCount() });
}
