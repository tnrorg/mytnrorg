// CV templates + the profile→CV snapshot builder.
export const CV_TEMPLATES = [
  ['modern',    'Modern Professional', 'Clean two-tone layout with a green accent bar.'],
  ['engineer',  'Software Engineer',   'Skills and projects promoted near the top.'],
  ['corporate', 'Corporate',           'Formal, conservative, experience-led.'],
  ['student',   'Student / Fresh Graduate', 'Education first, ideal with little experience.'],
  ['academic',  'Academic',            'Research, publications and certifications emphasised.'],
  ['intl',      'International Resume', 'Neutral formatting suited to overseas applications.'],
  ['ats',       'Minimal ATS-Friendly', 'Plain single-column, machine-readable.'],
];

export const CV_SECTIONS = [
  ['summary', 'Professional Summary'], ['experience', 'Work Experience'],
  ['education', 'Education'], ['skills', 'Skills'], ['projects', 'Projects'],
  ['certifications', 'Certifications'], ['languages', 'Languages'],
  ['volunteer', 'Volunteer Experience'], ['awards', 'Awards'],
];

// Snapshot the member's profile into editable CV content.
export function buildCvContent(p) {
  const core = p.core || {}, prof = p.profile || {};
  return {
    full_name: core.full_name || '',
    headline: prof.headline || core.current_position || '',
    email: core.email || '',
    phone: core.mobile || '',
    location: [prof.city, prof.country].filter(Boolean).join(', ') || core.village || '',
    linkedin: prof.linkedin_url || '',
    portfolio: prof.portfolio_url || '',
    github: prof.github_url || '',
    photo_url: core.photo_url || '',
    summary: prof.summary || '',
    awards: prof.awards || '',
    education: (p.education || []).map(e => ({
      title: [e.degree, e.field_of_study].filter(Boolean).join(' in ') || e.qualification || '',
      // Matches experience and volunteer, which already did this — a student
      // still enrolled was the only one whose CV showed a blank end date.
      org: e.institution || '', start: e.start_date || '',
      end: e.currently_studying ? 'Present' : (e.end_date || ''),
      note: [e.grade, e.description].filter(Boolean).join(' · '),
    })),
    experience: (p.experience || []).map(x => ({
      title: x.job_title || '', org: [x.organization, x.location].filter(Boolean).join(', '),
      start: x.start_date || '', end: x.currently_working ? 'Present' : (x.end_date || ''),
      note: [x.responsibilities, x.achievements].filter(Boolean).join('\n'),
    })),
    skills: (p.skills || []).map(s => ({ name: s.name, level: s.level || '' })),
    projects: (p.projects || []).map(x => ({
      title: x.name || '', org: x.technologies || '',
      note: x.description || '', link: x.project_url || x.github_url || '',
    })),
    certifications: (p.certifications || []).map(c => ({
      title: c.name || '', org: c.issuer || '', start: c.issue_date || '', end: c.expiry_date || '',
    })),
    languages: (p.languages || []).map(l => ({ name: l.language, level: l.proficiency || '' })),
    volunteer: (p.volunteer || []).map(v => ({
      title: v.role || '', org: v.organization || '',
      start: v.start_date || '', end: v.currently_active ? 'Present' : (v.end_date || ''),
      note: v.description || '',
    })),
  };
}

export const COVER_TEMPLATES = [
  ['professional', 'Professional'], ['modern', 'Modern'], ['formal', 'Formal Block'],
];
