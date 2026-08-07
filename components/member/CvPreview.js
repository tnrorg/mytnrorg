'use client';
const G = '#063D2B', GR = '#0B6B4F', GOLD = '#D4A72C';

// A4 print-ready CV. Uses browser print → "Save as PDF" (no paid PDF service,
// no extra dependency, and it stays ATS-readable because it is real text).
export default function CvPreview({ cv }) {
  const c = cv?.content || {};
  const vis = cv?.visible_sections || [];
  const on = (k) => vis.includes(k);
  const t = cv?.template || 'modern';
  const ats = t === 'ats';
  const accent = ats ? '#000' : (t === 'corporate' ? '#1F2937' : GR);

  const order = cv?.section_order?.length ? cv.section_order
    : (t === 'student' ? ['summary','education','experience','skills','projects','certifications','languages','volunteer','awards']
    : t === 'engineer' ? ['summary','skills','projects','experience','education','certifications','languages','volunteer','awards']
    : ['summary','experience','education','skills','projects','certifications','languages','volunteer','awards']);

  const H = ({ children }) => (
    <h2 style={{ color: accent, borderColor: ats ? '#999' : accent + '33' }}
      className="text-[11pt] font-black uppercase tracking-wide border-b pb-1 mb-2 mt-4">{children}</h2>
  );
  const Entry = ({ e }) => (
    <div className="mb-2.5">
      <div className="flex justify-between gap-3 items-baseline">
        <span className="font-bold text-[10.5pt]">{e.title}</span>
        {(e.start || e.end) && <span className="text-[9pt] text-gray-500 whitespace-nowrap">{e.start} — {e.end || 'Present'}</span>}
      </div>
      {e.org && <div className="text-[9.5pt] text-gray-600 italic">{e.org}</div>}
      {e.note && <div className="text-[9.5pt] mt-1 whitespace-pre-line leading-snug">{e.note}</div>}
      {e.link && <div className="text-[9pt]" style={{ color: accent }}>{e.link}</div>}
    </div>
  );
  const List = ({ items }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span key={i} className="text-[9.5pt] px-2 py-0.5 rounded"
          style={ats ? {} : { background: accent + '12', color: accent }}>
          {s.name}{s.level ? ` · ${s.level}` : ''}
        </span>
      ))}
    </div>
  );

  const body = {
    summary: c.summary && <p className="text-[9.5pt] leading-relaxed whitespace-pre-line">{c.summary}</p>,
    experience: c.experience?.length && c.experience.map((e, i) => <Entry key={i} e={e} />),
    education: c.education?.length && c.education.map((e, i) => <Entry key={i} e={e} />),
    skills: c.skills?.length && <List items={c.skills} />,
    projects: c.projects?.length && c.projects.map((e, i) => <Entry key={i} e={e} />),
    certifications: c.certifications?.length && c.certifications.map((e, i) => <Entry key={i} e={e} />),
    languages: c.languages?.length && <List items={c.languages} />,
    volunteer: c.volunteer?.length && c.volunteer.map((e, i) => <Entry key={i} e={e} />),
    awards: c.awards && <p className="text-[9.5pt] leading-relaxed whitespace-pre-line">{c.awards}</p>,
  };
  const LABEL = { summary: 'Professional Summary', experience: 'Work Experience', education: 'Education',
    skills: 'Skills', projects: 'Projects', certifications: 'Certifications', languages: 'Languages',
    volunteer: 'Volunteer Experience', awards: 'Awards & Achievements' };

  return (
    <div id="cv-sheet" className="bg-white mx-auto shadow-lg print:shadow-none"
      style={{ width: '210mm', minHeight: '297mm', padding: '14mm 14mm', fontFamily: ats ? 'Arial, sans-serif' : 'var(--font-mulish), Mulish, system-ui, sans-serif', color: '#111' }}>
      {/* Header */}
      <div className={`flex gap-4 items-center pb-3 ${ats ? '' : 'border-b-2'}`} style={{ borderColor: accent }}>
        {cv?.show_photo && c.photo_url && !ats && (
          <img src={c.photo_url} alt="" className="w-[26mm] h-[26mm] object-cover rounded-lg shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-[20pt] font-black leading-tight" style={{ color: ats ? '#000' : G }}>{c.full_name || 'Your Name'}</h1>
          {c.headline && <div className="text-[11pt] font-semibold" style={{ color: accent }}>{c.headline}</div>}
          <div className="text-[9pt] text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {c.email && <span>{c.email}</span>}{c.phone && <span>{c.phone}</span>}
            {c.location && <span>{c.location}</span>}{c.linkedin && <span>{c.linkedin}</span>}
            {c.github && <span>{c.github}</span>}{c.portfolio && <span>{c.portfolio}</span>}
          </div>
        </div>
      </div>

      {order.filter(on).map(k => body[k] ? (
        <section key={k} className="break-inside-avoid">
          <H>{LABEL[k]}</H>
          {body[k]}
        </section>
      ) : null)}
    </div>
  );
}
