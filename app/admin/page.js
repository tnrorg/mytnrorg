'use client';
import { useEffect, useState, useCallback } from 'react';
import { Logo } from '@/components/Brand';
import dynamicImport from 'next/dynamic';
import { getToken, clearToken, aGet } from '@/components/admin/adminApi';
import { Toast } from '@/components/admin/ui';
import Login from '@/components/admin/Login';
import DashboardTab from '@/components/admin/DashboardTab';
import MembersTab from '@/components/admin/MembersTab';
import MembershipTab from '@/components/admin/MembershipTab';
import ProfileRequestsTab from '@/components/admin/ProfileRequestsTab';
import MembersDirectoryTab from '@/components/admin/MembersDirectoryTab';
import CandidatesTab from '@/components/admin/CandidatesTab';
import ElectionsTab from '@/components/admin/ElectionsTab';
import RecordsTab from '@/components/admin/RecordsTab';
import ResultsTab from '@/components/admin/ResultsTab';
import LogsTab from '@/components/admin/LogsTab';
import CommitteeTab from '@/components/admin/CommitteeTab';
import RemindersTab from '@/components/admin/RemindersTab';
import LeadershipTab from '@/components/admin/LeadershipTab';
import MessagesTab from '@/components/admin/MessagesTab';
import BrandingTab from '@/components/admin/BrandingTab';
import AnnouncementsTab from '@/components/admin/AnnouncementsTab';
import NewsTab from '@/components/admin/NewsTab';
import OpportunitiesTab from '@/components/admin/OpportunitiesTab';
import HeroTab from '@/components/admin/HeroTab';
import ProjectsTab from '@/components/admin/ProjectsTab';
import InstitutionsTab from '@/components/admin/InstitutionsTab';
import CecTab from '@/components/admin/CecTab';
import CardTemplateTab from '@/components/admin/CardTemplateTab';
import CertificateTemplateTab from '@/components/admin/CertificateTemplateTab';
import AreasTab from '@/components/admin/AreasTab';
import SecurityTab from '@/components/admin/SecurityTab';
import ContactInboxTab from '@/components/admin/ContactInboxTab';
import OpinionsTab from '@/components/admin/OpinionsTab';
import TwoFactorSetup from '@/components/admin/TwoFactorSetup';
// Loaded on demand, only after the SERVER confirms Super Admin.
const CommitteeVoteTab = dynamicImport(() => import('@/components/admin/CommitteeVoteTab'), { ssr: false });
const AdminsTab = dynamicImport(() => import('@/components/admin/AdminsTab'), { ssr: false });
const VoterDataTab = dynamicImport(() => import('@/components/admin/VoterDataTab'), { ssr: false });
const VisitorsTab = dynamicImport(() => import('@/components/admin/VisitorsTab'), { ssr: false });

// Sidebar structure. All election functions live INSIDE the Election Portal group,
// leaving room for future platform modules (Membership, Community, Welfare…).
/* Every tab carries the permission area it belongs to.
 *
 * `null` means any signed-in admin: the dashboard, and their own security
 * settings. Hiding My Security from restricted admins would mean the people
 * most likely to share a device are the ones who cannot turn on 2FA.
 *
 * This only shapes the sidebar. The server refuses the underlying routes on
 * its own, so a hidden tab is a tidy panel, not the security control. */
const TOP_TABS = [
  ['dashboard', 'Dashboard', '📊', null],
  ['leadership', 'Leadership', '🏅', 'content'],
  ['hero', 'Hero Slides', '🖼️', 'content'],
  ['messages', 'Home Messages', '💬', 'content'],
  ['projects', 'Projects', '🏗️', 'content'],
  ['institutions', 'Schools & Colleges', '🏫', 'content'],
  ['cec', 'CEC Recruitment', '📋', 'cec'],
  ['opportunities', 'Opportunities', '💼', 'opportunities'],
  ['news', 'News & Announcements', '📰', 'content'],
  ['announcements', 'Ticker Notices', '📢', 'content'],
  ['branding', 'Branding', '✉️', 'content'],
  // Member-written pieces awaiting review.
  ['opinions', 'Opinions', '✍️', 'opinions'],
  // Messages from the four public contact forms.
  ['inbox', 'Contact Inbox', '📨', 'inbox'],
  // Every admin's own account security, not a super-admin tool — a control
  // only some people can reach is one most people never turn on.
  ['security', 'My Security', '🔐', null],
];
const ELECTION_TABS = [
  ['elections', 'Elections', '🗳️', 'election'], ['candidates', 'Candidates', '🎖️', 'election'],
  ['members', 'Members', '👥', 'election'],
  ['ecommittee', 'Committee', '🤝', 'election'], ['reminders', 'Reminders', '📧', 'election'],
  ['records', 'Voting Records', '📋', 'election'], ['results', 'Results', '🏆', 'election'],
  ['logs', 'Audit Logs', '🧾', 'election'],
];
// Super-admin election tools that also belong inside the group.
const ELECTION_SUPER = ['committee', 'voterdata'];
// Membership module (separate from the election system).
const MEMBERSHIP_TABS = [
  ['mapplications', 'Applications', '📝', 'membership'], ['mmembers', 'Members', '🪪', 'membership'],
  ['mrequests', 'Profile Requests', '✏️', 'membership'], ['mcard', 'Card Template', '🎫', 'membership'],
  ['mcert', 'Certificate Template', '📜', 'membership'], ['mareas', 'Areas', '📍', 'membership'],
];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [enrolRequired, setEnrolRequired] = useState(false);
  const [extraTabs, setExtraTabs] = useState([]);   // supplied by the server, empty for normal admins
  const [scopes, setScopes] = useState(null);       // null until the server answers
  const [scopesStale, setScopesStale] = useState(false);
  const [roleLabel, setRoleLabel] = useState('Control Panel');
  const [tab, setTab] = useState('dashboard');
  const [portalOpen, setPortalOpen] = useState(true);   // Election Portal group
  const [memOpen, setMemOpen] = useState(true);         // Membership group
  // The server is the only source of truth for what this account may see.
  async function loadMe() {
    const r = await aGet('/api/admin/me');
    if (!r?.ok) { setExtraTabs([]); setRoleLabel('Control Panel'); return; }
    setAdmin(a => a || { username: r.username, full_name: r.full_name });
    setExtraTabs(r.extra_tabs || []);
    setScopes(Array.isArray(r.scopes) ? r.scopes : []);
    setScopesStale(!!r.scopes_stale);
    setRoleLabel(r.label || 'Control Panel');
    // Also checked on a restored session, not just at sign-in: a token from
    // before 2FA was required would otherwise sail past the gate for its full
    // twelve hours.
    setEnrolRequired(!!r.enrol_required);
  }
  const hasTab = (k) => extraTabs.some(t => t[0] === k);

  const [toastMsg, setToastMsg] = useState(''); const [toastTone, setToastTone] = useState('ok');
  const [elections, setElections] = useState([]);

  const toast = (msg, tone = 'ok') => { setToastMsg(msg); setToastTone(tone); setTimeout(() => setToastMsg(''), 2600); };
  const reloadElections = useCallback(() => { aGet('/api/admin/elections').then(r => r.ok && setElections(r.elections)); }, []);

  useEffect(() => {
    if (getToken()) { setAuthed(true); loadMe(); }
    // enrolRequired MUST be cleared here too. It is set to true at a sign-in
    // that happens before enrolment, and the wizard signs the admin out on
    // purpose once they finish. Leaving the flag set meant coming back to the
    // setup screen after enrolling — the server was correctly reporting
    // "not required" while the client still believed its own stale answer.
    const onLogout = () => {
      setAuthed(false); setAdmin(null); setExtraTabs([]);
      setScopes(null); setScopesStale(false);
      setRoleLabel('Control Panel'); setEnrolRequired(false);
    };
    window.addEventListener('tnr-logout', onLogout);
    return () => window.removeEventListener('tnr-logout', onLogout);
  }, []);
  useEffect(() => { if (authed) reloadElections(); }, [authed, reloadElections]);

  if (!authed) return <Login onIn={(a, meta) => {
    setAdmin(a); setAuthed(true); setEnrolRequired(!!meta?.enrolRequired); loadMe();
    if (meta?.usedBackupCode)
      toast(`Signed in with a backup code — ${meta.backupCodesLeft ?? 0} left.`, 'warn');
  }} />;

  /* A super admin who has not enrolled sees the wizard instead of the panel.
   *
   * This is a prompt, not the enforcement. The real check is on the server in
   * requireSuperAdmin — a client-side gate is a suggestion, and anyone who can
   * open dev tools can decline a suggestion. */
  if (enrolRequired) return (
    <div className="admin-light min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-lg">
        <TwoFactorSetup forced onDone={() => setEnrolRequired(false)} />
        <button onClick={() => { clearToken(); setAuthed(false); setEnrolRequired(false); }}
          className="mt-3 text-xs text-tnr-cream/40 hover:text-tnr-cream/70 mx-auto block">
          Sign out
        </button>
      </div>
    </div>
  );

  /* Keep only the tabs this account's permission areas cover.
   *
   * While `scopes` is still null the server has not answered yet, so nothing
   * is filtered — a sidebar that flickers from full to restricted on every
   * load looks like a bug and invites people to reload until it "works". */
  const can = (scope) => scope === null || scopes === null || scopes.includes(scope);
  const allow = (list) => list.filter(t => can(t[3]));

  // Super-admin election tools join the group; anything else stays platform-level.
  const electionExtra = extraTabs.filter(t => ELECTION_SUPER.includes(t[0]));
  const platformExtra = extraTabs.filter(t => !ELECTION_SUPER.includes(t[0]));
  const topTabs = allow(TOP_TABS);
  const membershipTabs = allow(MEMBERSHIP_TABS);
  const electionTabs = [...allow(ELECTION_TABS), ...electionExtra];
  const TABS = [...topTabs, ...electionTabs, ...membershipTabs, ...platformExtra];
  // An admin whose access is narrowed mid-session can be sitting on a tab they
  // no longer hold. Fall back to the first tab they do — which is always the
  // Dashboard — rather than rendering a panel the server will refuse.
  const activeTab = TABS.find(t => t[0] === tab) || TABS[0];
  const view = activeTab?.[0] || 'dashboard';
  const inElection = electionTabs.some(t => t[0] === view);

  const NavBtn = ([k, label, icon], indent = false) => (
    <button key={k} onClick={() => setTab(k)}
      className={`flex items-center gap-2 ${indent ? 'md:pl-6' : ''} px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition
        ${view === k ? 'bg-tnr-gold text-tnr-black font-semibold' : 'text-tnr-cream/70 hover:bg-white/5'}`}>
      <span>{icon}</span>{label}
    </button>
  );

  return <div className="admin-light min-h-screen flex flex-col md:flex-row">
    <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-tnr-line bg-tnr-black/40 backdrop-blur">
      <div className="p-4 flex items-center gap-3 border-b border-tnr-line"><Logo size={40} />
        <div><div className="font-bold text-sm text-tnr-cream">TNR Admin</div>
          <div className="text-[10px] text-tnr-gold uppercase tracking-widest">{roleLabel}</div></div></div>
      <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
        {topTabs.map(t => NavBtn(t))}

        {/* ── Election Portal group ──
            The whole group disappears for an admin without election access,
            rather than showing a heading that opens onto nothing. */}
        {!!electionTabs.length && <>
        <button onClick={() => setPortalOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition
            ${inElection && !portalOpen ? 'bg-tnr-gold/20 text-tnr-goldLight' : 'text-tnr-cream/90 hover:bg-white/5'} font-semibold`}>
          <span>🏛️</span>Election Portal
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            className={`ml-auto hidden md:block transition ${portalOpen ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {portalOpen && electionTabs.map(t => NavBtn(t, true))}
        </>}

        {/* ── Membership group ── */}
        {!!membershipTabs.length && <>
        <button onClick={() => setMemOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition text-tnr-cream/90 hover:bg-white/5 font-semibold">
          <span>🪪</span>Membership
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            className={`ml-auto hidden md:block transition ${memOpen ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {memOpen && membershipTabs.map(t => NavBtn(t, true))}
        </>}

        {/* Platform-level tools (e.g. Admin Accounts) */}
        {!!platformExtra.length && <div className="hidden md:block h-px bg-tnr-line my-1" />}
        {platformExtra.map(t => NavBtn(t))}
      </nav>
      <div className="p-2 md:mt-auto">
        <button onClick={() => { clearToken(); setAuthed(false); }} className="w-full btn-ghost !py-2 text-sm">Sign out</button>
      </div>
    </aside>

    <main id="main" className="flex-1 p-4 sm:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          {inElection && <div className="text-[11px] uppercase tracking-widest text-tnr-cream/40">Election Portal</div>}
          <h1 className="text-2xl font-black heading-gold">{activeTab?.[1]}</h1>
        </div>
        <a href="/" className="text-sm text-tnr-cream/50 hover:text-tnr-gold">View site →</a>
      </div>

      {/* Permissions changed while this session was open. The sidebar already
          shows the new set; the signed token still carries the old one, so
          some requests would be judged against it until the next sign-in.
          Saying so beats letting someone hit a refusal with no explanation. */}
      {scopesStale && (
        <div className="mb-5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Your access has been updated by a Super Admin.
          <button onClick={() => { clearToken(); setAuthed(false); }}
            className="ml-2 underline font-semibold hover:text-white">Sign in again</button> to apply it.
        </div>
      )}

      {view === 'dashboard' && <DashboardTab />}
      {view === 'leadership' && <LeadershipTab toast={toast} />}
      {view === 'hero' && <HeroTab toast={toast} />}
      {view === 'messages' && <MessagesTab toast={toast} />}
      {view === 'news' && <NewsTab toast={toast} />}
      {view === 'opportunities' && <OpportunitiesTab toast={toast} />}
      {view === 'announcements' && <AnnouncementsTab toast={toast} />}
      {view === 'branding' && <BrandingTab toast={toast} />}
      {view === 'opinions' && <OpinionsTab toast={toast} />}
      {view === 'inbox' && <ContactInboxTab toast={toast} />}
      {view === 'security' && <SecurityTab />}
      {view === 'projects' && <ProjectsTab toast={toast} />}
      {view === 'institutions' && <InstitutionsTab toast={toast} />}
      {view === 'cec' && <CecTab toast={toast} />}
      {view === 'members' && <MembersTab toast={toast} />}
      {view === 'candidates' && <CandidatesTab toast={toast} elections={elections} />}
      {view === 'elections' && <ElectionsTab toast={toast} admin={admin} reloadElections={reloadElections} />}
      {view === 'records' && <RecordsTab />}
      {view === 'results' && <ResultsTab elections={elections} />}
      {view === 'logs' && <LogsTab />}
      {view === 'ecommittee' && <CommitteeTab toast={toast} />}
      {view === 'reminders' && <RemindersTab toast={toast} />}
      {view === 'committee' && hasTab('committee') && <CommitteeVoteTab toast={toast} />}
      {view === 'admins' && hasTab('admins') && <AdminsTab toast={toast} me={admin} />}
      {view === 'voterdata' && hasTab('voterdata') && <VoterDataTab toast={toast} />}
      {view === 'visitors' && hasTab('visitors') && <VisitorsTab toast={toast} />}
      {/* goTab lets the stat cards jump to the tab that holds what they count. */}
      {view === 'mapplications' && <MembershipTab toast={toast} goTab={setTab} />}
      {view === 'mrequests' && <ProfileRequestsTab toast={toast} />}
      {view === 'mmembers' && <MembersDirectoryTab toast={toast} />}
      {view === 'mcard' && <CardTemplateTab toast={toast} />}
      {view === 'mcert' && <CertificateTemplateTab toast={toast} />}
      {view === 'mareas' && <AreasTab toast={toast} />}
    </main>
    <Toast msg={toastMsg} tone={toastTone} />
  </div>;
}
