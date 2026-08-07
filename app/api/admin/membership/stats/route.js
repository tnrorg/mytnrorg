import { requireAdmin } from '@/lib/guard';
import { getMembershipStats } from '@/lib/membership/core';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  return ok(await getMembershipStats());
}
