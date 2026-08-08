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
import HeroTab from '@/components/admin/HeroTab';
import ProjectsTab from '@/components/admin/ProjectsTab';
import InstitutionsTab from '@/components/admin/InstitutionsTab';
import CecTab from '@/components/admin/CecTab';
import CardTemplateTab from '@/components/admin/CardTemplateTab';
import CertificateTemplateTab from '@/components/admin/CertificateTemplateTab';
import AreasTab from '@/components/admin/AreasTab';
// Loaded on demand, only after the SERVER confirms Super Admin.
const CommitteeVoteTab = dynamicImport(() => import('@/components/admin/CommitteeVoteTab'), { ssr: false });
const AdminsTab = dynamicImport(() => import('@/components/admin/AdminsTab'), { ssr: false });
const VoterDataTab = dynamicImport(() => import('@/components/admin/VoterDataTab'), { ssr: false });

// Sidebar structure. All election functions live INSIDE the Election Portal group,
// leaving room for future platform modules (Membership, Community, Welfare…).
const TOP_TABS = [
  ['dashboard', 'Dashboard', '📊'],
  ['leadership', 'Leadership', '🏅'],
  ['hero', 'Hero Slides', '🖼️'],
  ['messages', 'Home Messages', '💬'],
  ['projects', 'Projects', '🏗️'],
  ['institutions', 'Schools & Colleges', '🏫'],
  ['cec', 'CEC Recruitment', '📋'],
  ['branding', 'Branding', '✉️'],
];
const ELECTION_TABS = [
  ['elections', 'Elections', '🗳️'], ['candidates', 'Candidates', '🎖️'], ['members', 'Members', '👥'],
  ['ecommittee', 'Committee', '🤝'], ['reminders', 'Reminders', '📧'],
  ['records', 'Voting Records', '📋'], ['results', 'Results', '🏆'], ['logs', 'Audit Logs', '🧾'],
];
// Super-admin election tools that also belong inside the group.
const ELECTION_SUPER = ['committee', 'voterdata'];
// Membership module (separate from the election system).
const MEMBERSHIP_TABS = [['mapplications', 'Applications', '📝'], ['mmembers', 'Members', '🪪'], ['mrequests', 'Profile Requests', '✏️'], ['mcard', 'Card Template', '🎫'], ['mcert', 'Certificate Template', '📜'], ['mareas', 'Areas', '📍']];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [extraTabs, setExtraTabs] = useState([]);   // supplied by the server, empty for normal admins
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
    setRoleLabel(r.label || 'Control Panel');
  }
  const hasTab = (k) => extraTabs.some(t => t[0] === k);

  const [toastMsg, setToastMsg] = useState(''); const [toastTone, setToastTone] = useState('ok');
  const [elections, setElections] = useState([]);

  const toast = (msg, tone = 'ok') => { setToastMsg(msg); setToastTone(tone); setTimeout(() => setToastMsg(''), 2600); };
  const reloadElections = useCallback(() => { aGet('/api/admin/elections').then(r => r.ok && setElections(r.elections)); }, []);

  useEffect(() => {
    if (getToken()) { setAuthed(true); loadMe(); }
    const onLogout = () => { setAuthed(false); setAdmin(null); setExtraTabs([]); setRoleLabel('Control Panel'); };
    window.addEventListener('tnr-logout', onLogout);
    return () => window.removeEventListener('tnr-logout', onLogout);
  }, []);
  useEffect(() => { if (authed) reloadElections(); }, [authed, reloadElections]);

  if (!authed) return <Login onIn={a => { setAdmin(a); setAuthed(true); loadMe(); }} />;

  // Super-admin election tools join the group; anything else stays platform-level.
  const electionExtra = extraTabs.filter(t => ELECTION_SUPER.includes(t[0]));
  const platformExtra = extraTabs.filter(t => !ELECTION_SUPER.includes(t[0]));
  const electionTabs = [...ELECTION_TABS, ...electionExtra];
  const TABS = [...TOP_TABS, ...electionTabs, ...MEMBERSHIP_TABS, ...platformExtra];
  const activeTab = TABS.find(t => t[0] === tab) || TABS[0];
  const inElection = electionTabs.some(t => t[0] === tab);

  const NavBtn = ([k, label, icon], indent = false) => (
    <button key={k} onClick={() => setTab(k)}
      className={`flex items-center gap-2 ${indent ? 'md:pl-6' : ''} px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition
        ${tab === k ? 'bg-tnr-gold text-tnr-black font-semibold' : 'text-tnr-cream/70 hover:bg-white/5'}`}>
      <span>{icon}</span>{label}
    </button>
  );

  return <div className="admin-light min-h-screen flex flex-col md:flex-row">
    <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-tnr-line bg-tnr-black/40 backdrop-blur">
      <div className="p-4 flex items-center gap-3 border-b border-tnr-line"><Logo size={40} />
        <div><div className="font-bold text-sm text-tnr-cream">TNR Admin</div>
          <div className="text-[10px] text-tnr-gold uppercase tracking-widest">{roleLabel}</div></div></div>
      <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
        {TOP_TABS.map(t => NavBtn(t))}

        {/* ── Election Portal group ── */}
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

        {/* ── Membership group ── */}
        <button onClick={() => setMemOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition text-tnr-cream/90 hover:bg-white/5 font-semibold">
          <span>🪪</span>Membership
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            className={`ml-auto hidden md:block transition ${memOpen ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {memOpen && MEMBERSHIP_TABS.map(t => NavBtn(t, true))}

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
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'leadership' && <LeadershipTab toast={toast} />}
      {tab === 'hero' && <HeroTab toast={toast} />}
      {tab === 'messages' && <MessagesTab toast={toast} />}
      {tab === 'branding' && <BrandingTab toast={toast} />}
      {tab === 'projects' && <ProjectsTab toast={toast} />}
      {tab === 'institutions' && <InstitutionsTab toast={toast} />}
      {tab === 'cec' && <CecTab toast={toast} />}
      {tab === 'members' && <MembersTab toast={toast} />}
      {tab === 'candidates' && <CandidatesTab toast={toast} elections={elections} />}
      {tab === 'elections' && <ElectionsTab toast={toast} admin={admin} reloadElections={reloadElections} />}
      {tab === 'records' && <RecordsTab />}
      {tab === 'results' && <ResultsTab elections={elections} />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'ecommittee' && <CommitteeTab toast={toast} />}
      {tab === 'reminders' && <RemindersTab toast={toast} />}
      {tab === 'committee' && hasTab('committee') && <CommitteeVoteTab toast={toast} />}
      {tab === 'admins' && hasTab('admins') && <AdminsTab toast={toast} me={admin} />}
      {tab === 'voterdata' && hasTab('voterdata') && <VoterDataTab toast={toast} />}
      {tab === 'mapplications' && <MembershipTab toast={toast} />}
      {tab === 'mrequests' && <ProfileRequestsTab toast={toast} />}
      {tab === 'mmembers' && <MembersDirectoryTab toast={toast} />}
      {tab === 'mcard' && <CardTemplateTab toast={toast} />}
      {tab === 'mcert' && <CertificateTemplateTab toast={toast} />}
      {tab === 'mareas' && <AreasTab toast={toast} />}
    </main>
    <Toast msg={toastMsg} tone={toastTone} />
  </div>;
}
