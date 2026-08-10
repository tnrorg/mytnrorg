import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import AiFab from '@/components/site/AiFab';
import HeroCarousel from '@/components/home/HeroCarousel';
import ExecutiveCommittee from '@/components/home/ExecutiveCommittee';
import Ticker from '@/components/home/Ticker';
import CommunityStats from '@/components/home/CommunityStats';
import LeadershipMessages from '@/components/home/LeadershipMessages';
import CoreAreas from '@/components/home/CoreAreas';
import JoinCta from '@/components/home/JoinCta';
import MembersPreview from '@/components/home/MembersPreview';
import MembershipReach from '@/components/home/MembershipReach';
import CouncilSection from '@/components/home/CouncilSection';
import { getHeroSlides } from '@/lib/heroSlidesServer';

const C = { ink: '#15231D', bg: '#FDFDFD' };

/* Home page — a SERVER component.
 *
 * It used to carry 'use client', which meant the browser had to download and
 * hydrate React before anything on the page could ask for the hero image. The
 * chain was: HTML → JS → hydrate → fetch /api/public/hero → render <img> →
 * request the image. Five round trips before the largest element on the page
 * even started downloading, which is most of a 3.7s LCP on a phone.
 *
 * Now the slides are read here, on the server, and the first slide's <img> is
 * in the HTML the browser receives. The preload scanner finds it while the
 * page is still parsing. Every child below is still an ordinary client
 * component and behaves exactly as before.
 */

// The hero is admin-managed and changes rarely. Sixty seconds keeps the HTML
// cacheable — the whole point of moving this to the server — while an edit
// still appears within a minute rather than needing a redeploy.
export const revalidate = 60;

export default async function Home() {
  const slides = await getHeroSlides();

  // tnr-ambient lays two very faint radial gradients behind everything. Glass
  // panels need something underneath to refract — on a flat white page a
  // frosted panel just looks grey.
  return (
    <main style={{ background: C.bg, color: C.ink, fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' }}
      className="light-page tnr-ambient min-h-screen flex flex-col">
      <SiteNav />
      {/* Admin-managed slides, read on the server; falls back to the built-in
          hero when none exist. */}
      <HeroCarousel initialSlides={slides} />
      {/* Admin-managed scrolling notices (Admin → Announcements).
          Renders nothing when the list is empty. */}
      <Ticker />
      <CommunityStats />
      {/* Founder's then President's message — a human voice after the figures,
          before the leadership rosters. Renders nothing until an admin
          publishes one (Admin → Home Messages). */}
      <LeadershipMessages />
      {/* Leadership leads: who guides TNR, then what TNR does. */}
      <CouncilSection />
      <ExecutiveCommittee />
      <MembersPreview />
      {/* Pakistan and worldwide reach, straight after Membership Across Roundu.
          Renders nothing until members have recorded a current address. */}
      <MembershipReach />
      {/* What TNR does, after who its members are — the work reads better once
          the reader knows the people behind it, and it sits directly above the
          Join call to action it is meant to motivate. */}
      <CoreAreas />
      <JoinCta />
      <SiteFooter />
      <AiFab />
    </main>
  );
}
