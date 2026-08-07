/* Maps a member's CV Builder entries onto the public leadership profile.
 *
 * There are two parallel sets of records: the `council_*` tables an admin
 * curates, and the `member_*` tables a member fills in their own portal
 * (Education, Work Experience, Skills, Projects, Certifications, Languages,
 * Volunteer Experience). Only the first set was ever published, so a member
 * who completed their CV saw none of it appear.
 *
 * Rule: the curated entry wins. A member's CV rows are used for a section only
 * when that section has no admin-curated entries — so an admin who has written
 * a polished education history is never overwritten, and a member who has not
 * been curated still gets their work shown.
 *
 * Only CV content crosses over. Nothing from `member_profiles` (address,
 * WhatsApp, city) and no contact detail is touched: those were never entered
 * with publication in mind.
 */

/** '2021-05-03' → 2021. Null-safe: a missing date yields null, not 1970. */
const year = (d) => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return Number.isFinite(y) ? y : null;
};

/** Free-text responsibilities are one per line in the portal textarea. */
const lines = (t) => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);

export const CV_TABLES = [
  ['education',      'member_education'],
  ['experience',     'member_experience'],
  ['skills',         'member_skills'],
  ['projects',       'member_projects'],
  ['certifications', 'member_certifications'],
  ['languages',      'member_languages'],
  ['volunteer',      'member_volunteer_experience'],
];

export const MAP = {
  education: (r) => ({
    id: r.id,
    institution: r.institution,
    degree: [r.qualification, r.degree].filter(Boolean).join(' ') || r.degree,
    field_of_study: r.field_of_study,
    is_current: !!r.currently_studying,
    start_year: year(r.start_date),
    end_year: r.currently_studying ? null : year(r.end_date),
    grade: r.grade,
    description: r.description,
  }),

  experience: (r) => ({
    id: r.id,
    position: r.job_title,
    organisation: r.organization,
    is_current: !!r.currently_working,
    start_year: year(r.start_date),
    end_year: r.currently_working ? null : year(r.end_date),
    responsibilities: lines(r.responsibilities),
    contributions: r.achievements,
  }),

  projects: (r) => ({
    id: r.id,
    title: r.name,
    kind: 'Project',
    description: [r.description, r.technologies && `Built with ${r.technologies}`]
      .filter(Boolean).join('\n\n'),
    image_url: r.image_url,
    url: r.project_url || r.github_url,
    start_year: null,
    end_year: null,
  }),

  certifications: (r) => ({
    id: r.id,
    title: r.name,
    issuer: r.issuer,
    issue_date: r.issue_date,
    credential_id: r.credential_id,
    file_url: r.file_url,
    verify_url: r.credential_url,
  }),

  languages: (r) => ({ id: r.id, language: r.language, proficiency: r.proficiency }),

  volunteer: (r) => ({
    id: r.id,
    role: r.role,
    organisation: r.organization,
    area: r.area,
    is_current: !!r.currently_active,
    start_year: year(r.start_date),
    end_year: r.currently_active ? null : year(r.end_date),
    description: r.description,
  }),
};

/** Skill rows become plain names for the tag cloud. */
export const skillNames = (rows) =>
  [...new Set((rows || []).map(r => String(r.name || '').trim()).filter(Boolean))];
