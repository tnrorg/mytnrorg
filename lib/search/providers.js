import { ACTIVE_STATUSES } from '@/lib/membershipStats';
import { roleLabel } from '@/lib/membership/roles';
import { publicSelect, publicSelectBase, publicStatus } from '@/lib/opportunities';
import { PUBLIC_STATUS as STORY_PUBLIC } from '@/lib/successStories';
import { PUBLIC_INSTITUTION_COLUMNS } from '@/lib/institutions';
import { PUBLIC_PROJECT_COLUMNS } from '@/lib/projects';
import { NAV } from '@/components/site/navConfig';

/* ── Search providers — WHAT is searchable ───────────────────────────────────
 *
 * SERVER ONLY (called with the service-role client from lib/search/index.js).
 *
 * One provider per module. Each returns plain documents for the engine, and
 * each applies THE SAME visibility rule as that module's existing public page:
 *
 *   members        approved/active, not deleted, not hidden by an admin
 *   leadership     active profiles with a named holder
 *   news           published, inside its publish/expiry window
 *   opinions       published columns only — never the draft text
 *   opportunities  published; the public teaser columns only
 *   stories        published
 *   institutions   published        projects   published
 *
 * That is the whole security model of search: THE INDEX CONTAINS ONLY WHAT A
 * LOGGED-OUT VISITOR CAN ALREADY SEE ON THE SITE. There is no "filter private
 * results out afterwards" step to get wrong, because private rows are never
 * loaded. Email, mobile, CNIC, date of birth and address are not in any select
 * list below.
 *
 * Member-only modules — events, meetings, full opportunity details, the
 * ambassador portals — are deliberately NOT indexed.
 *
 * Every provider is independent and failure-tolerant: a table whose migration
 * has not been run costs that one category, not the search box.
 */

/** Groups smaller than this are reported as "fewer than 5", never exactly. */
export const SMALL_GROUP = 5;
const countText = (n, noun) => (n >= SMALL_GROUP
  ? `${n} registered TNR ${noun}`
  : n > 0 ? `fewer than ${SMALL_GROUP} registered TNR ${noun}` : `no registered TNR ${noun} yet`);

const plain = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/[#*_`>]+/g, ' ').replace(/\s+/g, ' ').trim();
const join = (...parts) => parts.filter(Boolean).join(' · ');
const fmtDate = (d) => {
  const t = Date.parse(d || '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};
const q = (s) => encodeURIComponent(s);

// ── Members + regional layer (one query feeds both) ─────────────────────────

async function membersAndRegion(sb) {
  const { data, error } = await sb.from('membership_members')
    .select('membership_id, full_name, role, photo_url, photo_public, public_visible, village, union_council, ' +
      'current_position, profession, profession_other, organization_name, current_country, education_level, approved_at')
    .in('status', ACTIVE_STATUSES).is('deleted_at', null).limit(20000);
  if (error) throw error;
  const rows = data || [];

  /* Listed individually only when not hidden — the same test the public
     directory uses. Hidden members still count towards village and UC totals,
     because a total does not identify anyone (and small totals are blurred). */
  const members = rows.filter(m => m.public_visible !== false && m.membership_id && m.full_name).map(m => {
    const work = m.profession === 'Other' ? m.profession_other : (m.profession || m.current_position);
    return {
      id: `member:${m.membership_id}`,
      type: 'member',
      title: m.full_name,
      description: join(work, [m.village, m.union_council].filter(Boolean).join(', ')),
      keywords: [m.membership_id, roleLabel(m.role), m.current_position, m.organization_name,
        m.current_country, m.education_level].filter(Boolean).join(' '),
      url: `/members/${q(m.membership_id)}`,
      thumbnail: m.photo_public === false ? null : (m.photo_url || null),
      meta: { membership_id: m.membership_id },
    };
  });

  const byVillage = new Map(), byUc = new Map(), byCountry = new Map();
  for (const m of rows) {
    const v = String(m.village || '').trim().toLowerCase();
    const u = String(m.union_council || '').trim().toLowerCase();
    if (v) byVillage.set(`${u}|${v}`, (byVillage.get(`${u}|${v}`) || 0) + 1);
    if (u) byUc.set(u, (byUc.get(u) || 0) + 1);
    const c = String(m.current_country || '').trim();
    if (c) byCountry.set(c, (byCountry.get(c) || 0) + 1);
  }
  return { members, total: rows.length, byVillage, byUc, byCountry };
}

async function region(sb, stats) {
  const [{ data: ucs, error }, { data: villages }, { data: inst }] = await Promise.all([
    sb.from('membership_union_councils').select('id, name').eq('active', true).order('name'),
    sb.from('membership_villages').select('union_council_id, name').eq('active', true).order('name'),
    sb.from('tnr_institutions').select('village, union_council').eq('published', true),
  ]);
  if (error) throw error;

  const instBy = new Map();
  for (const i of inst || []) {
    const k = String(i.village || '').trim().toLowerCase();
    if (k) instBy.set(k, (instBy.get(k) || 0) + 1);
  }
  const ucName = new Map((ucs || []).map(u => [u.id, u.name]));
  const docs = [];

  for (const u of ucs || []) {
    if (!u.name || u.name === 'Unassigned') continue;
    const mine = (villages || []).filter(v => v.union_council_id === u.id).map(v => v.name);
    const n = stats.byUc.get(u.name.trim().toLowerCase()) || 0;
    docs.push({
      id: `uc:${u.id}`, type: 'uc',
      title: u.name,
      description: join('Union Council of Roundu', `${mine.length} village${mine.length === 1 ? '' : 's'}`, countText(n, 'members')),
      keywords: `uc union council roundu ${mine.join(' ')}`,
      url: `/search?q=${q(u.name)}&tab=region`,
      meta: {
        villages: mine,
        tnr_members: n >= SMALL_GROUP ? n : null,
        // No official population source exists in TNR's records — say so.
        population: null,
      },
    });
  }

  for (const v of villages || []) {
    const uc = ucName.get(v.union_council_id);
    if (!v.name) continue;
    const ucKey = uc && uc !== 'Unassigned' ? uc.trim().toLowerCase() : '';
    const n = stats.byVillage.get(`${ucKey}|${v.name.trim().toLowerCase()}`) || 0;
    const schools = instBy.get(v.name.trim().toLowerCase()) || 0;
    docs.push({
      id: `village:${v.union_council_id}:${v.name}`, type: 'village',
      title: v.name,
      description: join(ucKey ? `Village in Union Council ${uc}` : 'Village in Roundu', countText(n, 'members'),
        schools ? `${schools} listed school${schools === 1 ? '' : 's'}` : null),
      keywords: `village roundu ${ucKey ? `uc ${uc}` : ''}`,
      url: `/search?q=${q(v.name)}`,
      meta: { union_council: ucKey ? uc : null, tnr_members: n >= SMALL_GROUP ? n : null, population: null },
    });
  }
  return docs;
}

// ── Leadership ──────────────────────────────────────────────────────────────

const BODY_TYPE = {
  executive: 'cec', advisory: 'advisory',
  country_ambassador: 'country_ambassador', ambassador: 'university_ambassador',
};

async function leadership(sb) {
  const { data, error } = await sb.from('leadership_profiles')
    .select('body, slug, name, designation, qualification, field, affiliation, summary, expertise, photo_url')
    .eq('active', true);
  if (error) throw error;
  /* Only posts with a named holder. A vacant office has no person to find. */
  return (data || []).filter(p => p.slug && String(p.name || '').trim() && BODY_TYPE[p.body]).map(p => ({
    id: `leader:${p.slug}`,
    type: BODY_TYPE[p.body],
    title: p.name,
    description: join(p.designation, p.affiliation),
    keywords: [p.qualification, p.field, Array.isArray(p.expertise) ? p.expertise.join(' ') : p.expertise].filter(Boolean).join(' '),
    body: plain(p.summary),
    url: `/council/${q(p.slug)}`,
    thumbnail: p.photo_url || null,
  }));
}

// ── Content ─────────────────────────────────────────────────────────────────

async function news(sb) {
  const { data, error } = await sb.from('news_posts')
    .select('id, slug, title, summary, body, cover_url, category, publish_at, expires_at, created_at, author_name')
    .eq('status', 'published').not('slug', 'is', null).limit(2000);
  if (error) throw error;
  const now = Date.now();
  return (data || []).filter(n =>
    (!n.publish_at || Date.parse(n.publish_at) <= now) &&      // not scheduled for later
    (!n.expires_at || Date.parse(n.expires_at) > now)          // not expired
  ).map(n => ({
    id: `news:${n.id}`, type: 'news',
    title: n.title,
    description: plain(n.summary),
    keywords: `news announcement ${n.category || ''} ${n.author_name || ''}`,
    body: plain(n.body),
    url: `/media/news/${q(n.slug)}`,
    thumbnail: n.cover_url || null,
    updated_at: n.publish_at || n.created_at,
    meta: { category: n.category || null },
  }));
}

async function opinions(sb) {
  const { data, error } = await sb.from('opinions')
    .select('id, slug, published_title, published_summary, published_body, published_cover, published_at')
    .eq('status', 'published').not('slug', 'is', null).limit(2000);
  if (error) throw error;
  return (data || []).filter(o => o.published_title).map(o => ({
    id: `opinion:${o.id}`, type: 'opinion',
    title: o.published_title,
    description: plain(o.published_summary),
    keywords: 'opinion blog article',
    body: plain(o.published_body),
    url: `/media/opinions/${q(o.slug)}`,
    thumbnail: o.published_cover || null,
    updated_at: o.published_at,
  }));
}

async function stories(sb) {
  const { data, error } = await sb.from('success_stories')
    .select('id, kind, title, organisation, description, achieved_on, image_url, published_at')
    .eq('status', STORY_PUBLIC).limit(2000);
  if (error) throw error;
  return (data || []).map(s => ({
    id: `story:${s.id}`, type: 'story',
    title: s.title,
    description: s.organisation || '',
    keywords: `success story achievement ${s.kind || ''}`,
    body: plain(s.description),
    url: '/media/success-stories',
    thumbnail: s.image_url || null,
    updated_at: s.published_at,
  }));
}

async function opportunities(sb) {
  /* The public TEASER columns only — eligibility, benefits and the apply link
     are member-only and are not selected. Falls back to the base columns when
     the v2 migration has not run, exactly as the public board does. */
  let { data, error } = await sb.from('opportunities').select(publicSelect()).eq('status', 'published').limit(1000);
  if (error) ({ data, error } = await sb.from('opportunities').select(publicSelectBase()).eq('status', 'published').limit(1000));
  if (error) throw error;
  return (data || []).map(o => {
    const end = o.closes_at || o.deadline;
    const st = publicStatus(o);
    const scholarship = o.category === 'Scholarship';
    return {
      id: `opp:${o.id}`, type: scholarship ? 'scholarship' : 'opportunity',
      title: o.title,
      description: join(o.short_description ? plain(o.short_description) : o.organization,
        end ? `${st === 'closed' ? 'Closed' : 'Deadline'} ${fmtDate(end)}` : null),
      keywords: `${o.category || ''} ${o.category_other || ''} ${o.organization || ''} opportunity ${end ? fmtDate(end) : ''}`,
      url: '/opportunities',
      thumbnail: o.cover_url || null,
      updated_at: o.published_at || o.created_at,
      demote: st === 'closed',
      meta: { deadline: end || null, status: st, category: o.category || null },
    };
  });
}

// ── Verified records: institutions and projects ─────────────────────────────

async function institutions(sb) {
  const { data, error } = await sb.from('tnr_institutions').select(PUBLIC_INSTITUTION_COLUMNS).eq('published', true).limit(3000);
  if (error) throw error;
  return (data || []).map(i => ({
    id: `inst:${i.id}`, type: 'institution',
    title: i.name,
    description: join([i.level, i.kind].filter(Boolean).join(' ').replace(/_/g, ' '),
      [i.village, i.union_council].filter(Boolean).join(', '),
      Number(i.students_total) > 0 ? `${i.students_total} students` : null),
    keywords: `school college education institution ${i.sector || ''} ${i.serves || ''} ${i.union_council || ''} ${i.village || ''}`,
    url: '/statistics/education',
    thumbnail: i.image_url || null,
    updated_at: i.last_verified || null,
    // Source and verification date travel with the figure, never without it.
    meta: { source: i.source || null, last_verified: i.last_verified || null },
  }));
}

async function projects(sb) {
  const { data, error } = await sb.from('tnr_projects').select(PUBLIC_PROJECT_COLUMNS).eq('published', true).limit(3000);
  if (error) throw error;
  return (data || []).map(p => ({
    id: `proj:${p.id}`, type: 'project',
    title: p.title,
    description: join(p.category, [p.village, p.union_council].filter(Boolean).join(', '),
      p.status ? String(p.status).replace(/_/g, ' ') : null, p.year),
    keywords: `project development scheme ${p.department || ''} ${p.scheme_no || ''}`,
    body: plain(p.summary),
    url: '/statistics/projects',
    thumbnail: p.image_url || null,
    updated_at: p.last_verified || null,
    meta: { source: p.source || null, last_verified: p.last_verified || null },
  }));
}

// ── Universities (TNR membership figure, never an enrolment figure) ─────────

async function universities(sb) {
  const { data: rows, error } = await sb.from('membership_members')
    .select('university_id').in('status', ACTIVE_STATUSES).is('deleted_at', null)
    .not('university_id', 'is', null).limit(20000);
  if (error) throw error;
  const n = new Map();
  for (const r of rows || []) n.set(r.university_id, (n.get(r.university_id) || 0) + 1);
  /* Only universities with enough members that naming one identifies nobody. */
  const ids = [...n.entries()].filter(([, c]) => c >= SMALL_GROUP).map(([id]) => id);
  if (!ids.length) return [];
  const { data: unis } = await sb.from('tnr_universities').select('id, name, province').in('id', ids);
  return (unis || []).map(u => ({
    id: `uni:${u.id}`, type: 'university',
    title: u.name,
    description: join(u.province, `${n.get(u.id)} registered TNR members study or work here`),
    keywords: 'university institution students',
    url: '/about/university-ambassadors',
    meta: { tnr_members: n.get(u.id) },
  }));
}

// ── Static: site pages and the statistics that exist ────────────────────────

const PAGE_KEYWORDS = {
  '/about': 'tnr tehreek e nojawanan roundu about introduction objectives initiatives',
  '/about/vision-mission': 'vision mission objectives aims goals',
  '/about/constitution': 'constitution rules articles dastoor',
  '/about/governance': 'governance structure organisation bodies',
  '/about/code-of-conduct': 'code of conduct rules discipline ethics',
  '/membership/apply': 'join register registration become member apply',
  '/membership/verify': 'verify membership card check id',
  '/membership/status': 'application status track',
  '/opportunities': 'scholarships jobs internships fellowships opportunities',
  '/election-portal': 'election vote voting candidates results',
};

function pages() {
  const seen = new Set(), docs = [];
  const add = (label, href, section) => {
    if (!href || !href.startsWith('/') || seen.has(href)) return;
    seen.add(href);
    docs.push({
      id: `page:${href}`, type: 'page', title: label,
      description: section && section !== label ? section : 'Tehreek-e-Nojawanan Roundu',
      keywords: PAGE_KEYWORDS[href] || '', url: href,
    });
  };
  /* Built from the live navigation, so a page is searchable exactly when it
     is linked — and "coming soon" entries, which have no page, are skipped. */
  for (const n of NAV) {
    if (n.href && !n.soon) add(n.label, n.href, null);
    for (const i of n.items || []) if (!i.soon) add(i.label, i.href, n.label);
  }
  return docs;
}

function statistics(stats) {
  const abroad = [...stats.byCountry.entries()].filter(([c, n]) => c !== 'Pakistan' && n >= SMALL_GROUP).length;
  return [
    {
      id: 'stat:membership', type: 'statistic',
      title: 'TNR Membership in Numbers',
      description: `${stats.total} registered TNR members — by Union Council, village, gender and education. A count of TNR's members, not of Roundu's population.`,
      keywords: 'roundu statistics membership distribution members count union council village gender registered',
      url: '/statistics',
      meta: { kind: 'tnr', note: 'Calculated from approved TNR membership records.' },
    },
    {
      id: 'stat:population', type: 'statistic',
      title: 'Roundu population and demographics',
      description: 'Official figures: data not available. TNR holds no verified census source for Roundu and does not publish estimates in its place.',
      keywords: 'roundu population census demographics households official abadi people total',
      url: '/statistics',
      meta: { kind: 'official', note: 'Data not available.' },
    },
    {
      id: 'stat:education', type: 'statistic',
      title: 'Education Statistics',
      description: 'Schools and colleges of Roundu — students, teachers and staffing by Union Council and village. Each record carries its source and the date it was verified.',
      keywords: 'roundu education schools colleges students teachers literacy statistics',
      url: '/statistics/education',
      meta: { kind: 'official', note: 'From the TNR institutions register; source shown per institution.' },
    },
    {
      id: 'stat:employment', type: 'statistic',
      title: 'Employment Statistics',
      description: 'Professions and work-or-study status of TNR members. TNR membership figures, not a labour survey of Roundu.',
      keywords: 'employment professions jobs students professionals work statistics representation',
      url: '/statistics/employment',
      meta: { kind: 'tnr', note: 'Calculated from approved TNR membership records.' },
    },
    {
      id: 'stat:projects', type: 'statistic',
      title: 'Development Projects',
      description: 'Public development schemes in Roundu with cost, progress and source.',
      keywords: 'projects development schemes funds progress statistics',
      url: '/statistics/projects',
      meta: { kind: 'official', note: 'Source shown per project.' },
    },
    {
      id: 'stat:countries', type: 'statistic',
      title: 'TNR members around the world',
      description: abroad
        ? `TNR members are registered in ${abroad} countr${abroad === 1 ? 'y' : 'ies'} outside Pakistan (countries with fewer than ${SMALL_GROUP} members are not listed).`
        : 'Country-wise distribution of TNR members.',
      keywords: 'country countries overseas abroad international diaspora members representation',
      url: '/members',
      meta: { kind: 'tnr', note: 'Calculated from approved TNR membership records.' },
    },
  ];
}

// ── Registry ────────────────────────────────────────────────────────────────

/**
 * Load every public document. Returns { docs, health } where health maps each
 * provider to 'ok' or the reason it was skipped.
 */
export async function loadAllDocuments(sb) {
  const health = {};
  const safe = async (name, fn, fallback = []) => {
    try { const r = await fn(); health[name] = 'ok'; return r; }
    catch (e) { health[name] = String(e?.message || e).slice(0, 120); return fallback; }
  };

  const emptyStats = { members: [], total: 0, byVillage: new Map(), byUc: new Map(), byCountry: new Map() };
  const stats = await safe('members', () => membersAndRegion(sb), emptyStats);

  const parts = await Promise.all([
    safe('region', () => region(sb, stats)),
    safe('leadership', () => leadership(sb)),
    safe('news', () => news(sb)),
    safe('opinions', () => opinions(sb)),
    safe('stories', () => stories(sb)),
    safe('opportunities', () => opportunities(sb)),
    safe('institutions', () => institutions(sb)),
    safe('projects', () => projects(sb)),
    safe('universities', () => universities(sb)),
  ]);

  return {
    docs: [...stats.members, ...parts.flat(), ...pages(), ...(health.members === 'ok' ? statistics(stats) : [])],
    health,
  };
}
