// ── TNR site navigation ────────────────────────────────────────────────────
// Structure follows the 10-item information architecture: Home, About TNR,
// Leadership, Initiatives, Membership, Members, Opportunities, Media,
// Election Portal, Contact.
//
// IMPORTANT: an audit found 73 of the previous 94 nav links pointed at pages
// that do not exist. Every entry is now either a real route or explicitly
// marked `soon`, which the header renders as a non-clickable "Soon" chip.
// That keeps the full roadmap visible without sending anyone to a 404.
// When a page is built, delete its `soon: true` and the link goes live.
//
// Election Portal points at the LIVE existing system — nothing here touches
// election data, APIs or logic.

const soon = (label, href) => ({ label, href, soon: true });
const live = (label, href) => ({ label, href });

export const NAV = [
  { label: 'Home', href: '/' },

  { label: 'About TNR', href: '/about', items: [
    live('About Us', '/about'),
    live('Vision & Mission', '/about/vision-mission'),
    live('Constitution', '/about/constitution'),
    live('Governance Structure', '/about/governance'),
    live('Code of Conduct', '/about/code-of-conduct'),
    soon('History of TNR', '/about/history'),
  ]},

  { label: 'Leadership', href: '/about/executive-committee', items: [
    live('Central Executive Committee', '/about/executive-committee'),
    live('Advisory Council', '/about/advisory-council'),
    live('Apply for an Executive Position', '/cec/apply'),
    live('Office Bearers', '/about/office-bearers'),
    soon('Election Committee', '/about/election-committee'),
    soon('Previous Leadership', '/about/previous-leadership'),
    soon("President's Message", '/about/presidents-message'),
  ]},

  { label: 'Initiatives', items: [
    soon('Education & Scholarships', '/initiatives/education'),
    soon('Youth Development', '/initiatives/youth'),
    soon('Community Welfare', '/initiatives/welfare'),
    soon('Health Awareness', '/initiatives/health'),
    soon('Women Empowerment', '/initiatives/women'),
    soon('Projects & Impact', '/initiatives/projects'),
  ]},

  { label: 'Membership', href: '/membership', items: [
    live('Membership Overview', '/membership'),
    live('Become a Member', '/membership/apply'),
    live('Check Application Status', '/membership/status'),
    live('Verify Membership', '/membership/verify'),
    live('Members Analytics', '/members'),
    live('Member Login', '/member/login'),
    soon('Eligibility & Guidelines', '/membership/eligibility'),
    soon('Volunteer With TNR', '/volunteer'),
  ]},

  { label: 'Opportunities', href: '/member/opportunities', items: [
    live('Browse Opportunities', '/member/opportunities'),
    soon('Jobs & Internships', '/opportunities/jobs'),
    soon('Scholarships', '/opportunities/scholarships'),
    soon('Training & Mentorship', '/opportunities/training'),
  ]},

  // The first entry is live and computed from membership records. The rest are
  // district-level facts about Roundu that member data cannot answer — they
  // need official sources, so they stay marked as planned.
  { label: 'Roundu Statistics', href: '/statistics', items: [
    live('TNR Membership in Numbers', '/statistics'),
    live('Education Statistics', '/statistics/education'),
    live('Employment Statistics', '/statistics/employment'),
    live('Projects Statistics', '/statistics/projects'),
    soon('Population', '/statistics/population'),
    soon('Literacy Rate', '/statistics/literacy'),
    soon('Health Statistics', '/statistics/health'),
    soon('Tourism Statistics', '/statistics/tourism'),
    soon('Interactive Reports', '/statistics/reports'),
  ]},

  { label: 'Media', items: [
    // Member-written pieces, published after committee review.
    live('Opinions', '/media/opinions'),
    soon('News & Announcements', '/media/news'),
    soon('Press Releases', '/media/press'),
    soon('Photo Gallery', '/media/photos'),
    soon('Video Gallery', '/media/videos'),
    soon('Publications & Downloads', '/media/downloads'),
    soon('Upcoming Events', '/events'),
  ]},

  { label: 'Election Portal', href: '/election-portal', highlight: true, items: [
    live('Current Election', '/election-portal'),
    live('Voter Verification', '/vote'),
    live('Election Results', '/results'),
    live('Live Dashboard', '/dashboard'),
    live('Election Guidelines', '/election-portal#process'),
  ]},

  { label: 'Contact', items: [
    // All four are built and reach the same inbox; only the FAQ page is still
    // to come. A "Soon" chip on a page that exists is worse than no chip —
    // it tells people not to bother clicking.
    live('Contact Us', '/contact'),
    live('Feedback', '/contact/feedback'),
    live('Complaints', '/contact/complaints'),
    live('Technical Support', '/contact/support'),
    soon('Help Centre & FAQs', '/help'),
  ]},
];

// Footer legal / policy links. Live governance documents point at the real
// About pages; the rest are marked soon for the same reason as above.
export const FOOTER_LINKS = [
  live('Constitution', '/about/constitution'),
  live('Code of Conduct', '/about/code-of-conduct'),
  live('Governance', '/about/governance'),
  soon('Privacy Policy', '/legal/privacy'),
  soon('Terms & Conditions', '/legal/terms'),
  soon('Accessibility', '/legal/accessibility'),
  soon('Sitemap', '/sitemap'),
];

/** Flattened list of routes still to be built — handy for a roadmap page. */
export const PLANNED_ROUTES = NAV
  .flatMap(n => n.items || [])
  .concat(FOOTER_LINKS)
  .filter(i => i.soon)
  .map(i => i.href);
