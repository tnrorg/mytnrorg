'use client';
const G = '#063D2B', GR = '#0B6B4F', GOLD = '#D4A72C';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2006-02-10" → "Feb 2006".
 *
 * Parsers look for a month and a year. An ISO date reads as a number string,
 * and the day is noise on a CV — nobody is hired on the strength of starting
 * a job on the 10th. Values that are already words ("Present") pass through.
 */
function fmtDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return s;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : m[1];
}

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
        {/* An en dash between dates extracts as a stray character in some
            parsers. A plain hyphen with spaces is the safest range separator,
            and dates are normalised to "Feb 2006" — an ISO string reads as a
            number to a parser looking for a month. */}
        {(e.start || e.end) && (
          <span className="text-[9pt] text-gray-500 whitespace-nowrap">
            {fmtDate(e.start)} - {fmtDate(e.end) || 'Present'}
          </span>
        )}
      </div>
      {e.org && <div className="text-[9.5pt] text-gray-600 italic">{e.org}</div>}
      {e.note && <div className="text-[9.5pt] mt-1 whitespace-pre-line leading-snug">{e.note}</div>}
      {e.link && <div className="text-[9pt]" style={{ color: accent }}>{e.link}</div>}
    </div>
  );

  /* Skills and languages.
     Chips laid out with flex carry no separator in the text layer, so a parser
     reads "EnglishUrduMalayBaltiHindko" as one token and the whole section is
     wasted. Every template therefore emits a real comma-separated line; the
     decorated ones draw chips on top of it and hide the text copy visually. */
  const List = ({ items }) => {
    const line = items.map(s => s.name + (s.level ? ` (${s.level})` : '')).join(', ');
    if (ats) return <p className="text-[9.5pt] leading-relaxed">{line}</p>;
    return (
      <>
        <span className="tnr-sr-only">{line}</span>
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {items.map((s, i) => (
            <span key={i} className="text-[9.5pt] px-2 py-0.5 rounded"
              style={{ background: accent + '12', color: accent }}>
              {s.name}{s.level ? ` · ${s.level}` : ''}
            </span>
          ))}
        </div>
      </>
    );
  };

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
  /* Section headings.
     These are the strings applicant tracking systems match against, so they
     use the conventional wording rather than anything more inventive.
     "Awards & Achievements" is dropped in favour of "Awards": an ampersand is
     a known splitting point for some parsers, and the shorter form is the one
     on every standard heading list. */
  const LABEL = { summary: 'Professional Summary', experience: 'Work Experience', education: 'Education',
    skills: 'Skills', projects: 'Projects', certifications: 'Certifications', languages: 'Languages',
    volunteer: 'Volunteer Experience', awards: 'Awards' };

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
          {/* Contact line.
              These used to be bare flex spans with only a CSS gap between
              them, so the extracted text was
              "name@mail.com+60136121472KL, MALAYSIA" — one unparseable token,
              and the email and phone were lost. A visible "|" puts a real
              separator in the text layer. */}
          <div className="text-[9pt] text-gray-600 mt-1 leading-relaxed">
            {[c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio]
              .filter(Boolean)
              .map((v, i, arr) => (
                <span key={i}>
                  {v}{i < arr.length - 1 && <span className="mx-2 text-gray-400">|</span>}
                </span>
              ))}
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
