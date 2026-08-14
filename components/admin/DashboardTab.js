'use client';
import { useEffect, useState } from 'react';
import MembershipOverview from './MembershipOverview';
import { aGet } from './adminApi';
import { Card, Stat, Badge } from './ui';

export default function DashboardTab() {
  const [d, setD] = useState(null);
  useEffect(() => { aGet('/api/admin/dashboard').then(setD); }, []);
  if (!d?.ok) return <p className="text-tnr-cream/50">Loading…</p>;

  // The election has concluded, so membership leads the dashboard and the
  // election figures sit at the end as a record.
  //
  // Everything under the "Election Portal" heading comes from the ELECTION
  // system — the voter roll and ballots. "Approved / Pending / Blocked" are
  // VOTER statuses, not membership ones, which is why the labels say so
  // explicitly: two sets of member numbers on one screen is a trap.
  const ended = d.election && String(d.election.status).toLowerCase() === 'ended';

  /* Sections follow the admin's permission areas.
   *
   * The server decides — it simply does not send figures for an area this
   * account cannot open, and these flags describe what it sent. An admin
   * restricted to one area gets a dashboard about that area rather than a
   * screen of zeros that looks like the organisation has no members. */
  const showMembership = d.show_membership !== false;
  const showElection = d.show_election !== false && !!d.members;

  return <div className="space-y-6">

    {!showMembership && !showElection && (
      <p className="text-tnr-cream/50 text-sm">
        Your account covers areas that don&rsquo;t have dashboard figures.
        Pick a section from the menu to get started.
      </p>
    )}

    {/* ── Membership ─────────────────────────────────────────────────────── */}
    {showMembership && <div>
      <h2 className="text-lg font-black text-tnr-cream mb-3">Membership Overview</h2>
      <MembershipOverview />
    </div>}

    {/* ── Election Portal (concluded) ────────────────────────────────────── */}
    {showElection && <div className="pt-2">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-lg font-black text-tnr-cream/70">Election Portal</h2>
        {d.election && <Badge>{d.election.status}</Badge>}
        {ended && (
          <span className="text-[11px] text-tnr-cream/40">
            Archived record — this election has concluded
          </span>
        )}
      </div>

      <div className="space-y-3" style={{ opacity: ended ? 0.85 : 1 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Registered Voters" value={d.members.total} />
          <Stat label="Approved Voters" value={d.members.approved} tone="green" />
          <Stat label="Pending Voters" value={d.members.pending} tone="gold" />
          <Stat label="Blocked Voters" value={d.members.blocked} tone="red" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Votes Cast" value={d.votes_cast} tone="gold" />
          <Stat label="Total Voters" value={d.total_voters} />
          <Stat label="Remaining" value={d.remaining} />
          <Stat label="Active Elections" value={d.active_elections} tone="green" />
        </div>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-tnr-goldLight">Election Progress</h3>
            {d.election && <Badge>{d.election.status}</Badge>}
          </div>
          {d.election ? <>
            <p className="text-tnr-cream/70 text-sm mb-2">{d.election.title}</p>
            {/* Cap the bar at 100% — a turnout over 100 would otherwise render
                as a bar overflowing its track. The real figure is still shown
                below, and flagged. */}
            <div className="h-3 rounded-full bg-black/40 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-tnr-green2 to-tnr-gold"
                style={{ width: `${Math.min(100, d.progress)}%` }} />
            </div>
            <p className="text-right text-xs text-tnr-goldLight mt-1">{d.progress}% turnout</p>
            {d.progress > 100 && (
              <p className="mt-2 text-[11px] text-amber-300">
                Turnout above 100% means more ballots are recorded than there are registered
                voters. Worth reconciling the voter roll against the vote records before this
                figure is published anywhere.
              </p>
            )}
          </> : <p className="text-tnr-cream/50 text-sm">No active election.</p>}
        </Card>
      </div>
    </div>}

    {/* Recent Activity is visible to Super Admins only. */}
    {d.show_activity && <Card>
      <h3 className="font-bold text-tnr-goldLight mb-3">Recent Activity</h3>
      <div className="space-y-1.5 max-h-72 overflow-auto">
        {(d.recent_logs || []).map(l => (
          <div key={l.id} className="flex items-center justify-between text-sm border-b border-tnr-line/50 py-1.5">
            <span className="text-tnr-cream/80">
              <b className="text-tnr-goldLight">{l.action}</b> {l.details ? `— ${l.details}` : ''}
            </span>
            <span className="text-tnr-cream/40 text-xs whitespace-nowrap ml-3">
              {new Date(l.created_at).toLocaleString()}
            </span>
          </div>
        ))}
        {!(d.recent_logs || []).length && <p className="text-tnr-cream/40 text-sm">No activity yet.</p>}
      </div>
    </Card>}
  </div>;
}
