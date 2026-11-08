// Shared option lists for the membership application (client-safe, no secrets).
export const GENDERS = [
  'Male', 'Female', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say',
];

/* The option that opens a free-text box, held as a constant because four files
 * compare against it and a typo in any one of them silently disables the box.
 * Same arrangement as PROFESSIONS + 'Other' → profession_other. */
export const GENDER_SELF_DESCRIBE = 'Prefer to self-describe';

/** The gender to display: the typed text when they self-described. */
export function displayGender(row = {}) {
  return row.gender === GENDER_SELF_DESCRIBE
    ? (String(row.gender_self_described || '').trim() || GENDER_SELF_DESCRIBE)
    : (row.gender || '');
}

/* Everything that reads meaning from `gender` goes through the two helpers
 * below. The rules were previously written out by hand in the validator, the
 * application form, three avatar components and an admin dropdown — six copies
 * that had already drifted apart. "Prefer not to say" was optional-photo in one
 * place and required-photo in another, purely because one list had been updated
 * and the others had not.
 *
 * `gender` is a free-text column with years of existing values in it ('Other',
 * blanks, legacy imports), so both helpers match loosely and always have a
 * defined answer for input they have never seen.
 */

/** Photo may be left blank. */
export function photoOptionalFor(gender) {
  // Female only. Publishing a photograph is a real privacy concern for many
  // women in this community, and that is the specific case this exists for.
  return String(gender || '').trim().toLowerCase() === 'female';
}

/**
 * Which placeholder silhouette to draw when a member has no photo.
 * Returns 'female' | 'male' | 'neutral'.
 */
export function genderIconKind(gender) {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'female') return 'female';
  if (g === 'male') return 'male';
  /* Non-binary, Prefer to self-describe, Prefer not to say, legacy 'Other',
   * and blank.
   *
   * Self-described text is deliberately NOT parsed to guess an icon. Reading
   * someone's own words and then deciding which silhouette they "really" are
   * is precisely the judgement this field exists to avoid — and it would get
   * it wrong. A blank likewise gets neutral: it used to draw the male
   * silhouette, which stated something the member never did. */
  return 'neutral';
}

export const EDUCATION_LEVELS = [
  'No Formal Education', 'Secondary School', 'Higher Secondary', 'Diploma',
  'Technical or Vocational Education', "Bachelor's Degree", "Master's Degree",
  'MPhil', 'PhD', 'Religious Education', 'Other',
];

// Short forms for the dropdown education levels. Leadership cards should read
// "BS Software Engineering", not the generic "Bachelor's Degree".
const DEGREE_SHORT = {
  "Bachelor's Degree": 'BS',
  "Master's Degree": 'MS',
  'MPhil': 'MPhil',
  'PhD': 'PhD',
  'Diploma': 'Diploma',
  'Technical or Vocational Education': 'Technical',
  'Higher Secondary': 'Higher Secondary',
  'Secondary School': 'Matric',
  'Religious Education': 'Religious Education',
};

/**
 * Academic title for a leadership card.
 *
 * Combines the level with the subject when the level is one of the known
 * dropdown values — "Bachelor's Degree" + "Software Engineering" reads as
 * "BS Software Engineering".
 *
 * Anything the person typed themselves is left exactly as written, so
 * "MS in Chemistry" or "MBBS, FCPS" is never rewritten into something else.
 */
export function academicTitle(qualification, field) {
  const q = String(qualification || '').trim();
  const f = String(field || '').trim();
  if (!q) return f || null;

  const short = DEGREE_SHORT[q];
  if (!short) return q;                 // free text — leave it alone
  if (!f) return short === q ? q : short;
  return `${short} ${f}`;
}

export const POSITIONS = [
  'Student', 'Employee', 'Government Employee', 'Private-Sector Employee',
  'Business Owner', 'Freelancer', 'Teacher or Educator', 'Social Worker',
  'Job Seeker', 'Unemployed', 'Retired', 'Other',
];

export const CONTRIBUTION_AREAS = [
  'Education and Scholarships', 'Career Guidance and Mentorship',
  'Information Technology and Digital Services', 'Youth Development',
  'Community Welfare', 'Health and Awareness', 'Sports and Cultural Activities',
  'Environmental Protection', 'Media and Communications', 'Women Empowerment',
  'Skills Development', 'Employment Opportunities', 'Volunteer and Relief Work',
  'Overseas Coordination', 'Research and Policy Development',
  'Tourism Development', 'Entrepreneurship', 'Other',
];

export const LEADERSHIP_OPTIONS = ['Yes', 'No', 'Not Sure'];

/* WhatsApp groups, offered on the confirmation screen after applying.
 *
 * TNR runs separate groups for women and men — that is how the community
 * organises itself, and a single mixed group would keep some women out of the
 * conversation altogether rather than including everyone.
 *
 * Anyone who did not state a binary gender is offered NO link rather than
 * being guessed at and sent to the wrong room. They are told to contact the
 * committee, which is a small friction for a handful of people and much better
 * than a machine deciding which group somebody belongs in. */
export const WHATSAPP_GROUPS = {
  female: 'https://chat.whatsapp.com/JKR9chIQXqbKssi9WE1cBo?mode=gi_t',
  male: 'https://chat.whatsapp.com/DVPEdnszbDWLGq4dUJqqPY?mode=gi_t',
};

/** The group link for a stated gender, or null when there is no clear answer. */
export function whatsappGroupFor(gender) {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'female') return WHATSAPP_GROUPS.female;
  if (g === 'male') return WHATSAPP_GROUPS.male;
  return null;
}

/* Two questions that used to be free paragraphs.
 *
 * They now offer a fixed choice, which is the difference between answers the
 * committee can COUNT and answers it can only read. "Lack of employment
 * opportunities — 61 of 90 applicants" is a finding; ninety paragraphs saying
 * roughly that are an afternoon's work and no number at the end of it.
 *
 * The columns are unchanged — `why_join` and `youth_issues` still store text,
 * so every existing application, export and admin screen keeps working. What
 * changed is that the text now comes from this list. */
export const WHY_JOIN_OPTIONS = [
  'Serve the Roundu community',
  'Contribute my skills and experience',
  'Support youth development',
];

export const YOUTH_ISSUE_OPTIONS = [
  'Lack of employment opportunities',
  'Limited access to education and career guidance',
  'Lack of professional and digital skills',
];

export const DECLARATION_VERSION = 'v1.0';
export const DECLARATION_TEXT =
  'I confirm that the information provided in this application is correct and complete. ' +
  'I support peaceful, constructive, and responsible political awareness and community ' +
  'engagement for the better future of Roundu. I agree to respect the constitution, ' +
  'policies, values, and code of conduct of Tehreek-e-Naujawanan Roundu.';

/* Profession / field of work, for the searchable dropdown in Step 3.
 *
 * Separate from `field_of_study`, which asks what the applicant STUDIED. A
 * Computer Science graduate working in banking answers both differently, and
 * collapsing the two would lose whichever one the member cares about.
 *
 * "Other" is last on purpose — it is the escape hatch, not a suggestion. */
/* 244 entries, searchable.
 *
 * It was 52, which is why an applicant studying Glaciology or Actuarial
 * Science reached this field, found nothing of theirs, and had to fall back
 * on "Other" — turning the single most useful thing TNR knows about a member
 * into an unusable bucket. The control is a type-to-search combobox, so
 * length costs the applicant nothing: they type three letters and see their
 * subject. A short list only looks tidy to whoever wrote it.
 *
 * EVERY ONE OF THE ORIGINAL 52 STRINGS IS STILL HERE, EXACTLY AS IT WAS.
 * These values are stored verbatim on member records, so renaming or
 * dropping one would leave that member's saved answer matching no option
 * and the field showing blank the next time anybody opened their profile.
 * Additions are safe; edits are not.
 *
 * Sorted case-insensitively, with "Other" pinned last — it is the escape
 * hatch, not a suggestion. Grouped by discipline in the commit that added
 * them if you need to extend a particular area. */
/* 244 entries, searchable.
 *
 * It was 52, which is why an applicant studying Glaciology or Actuarial
 * Science reached this field, found nothing of theirs, and fell back on
 * "Other" — turning the most useful thing TNR knows about a member into an
 * unusable bucket. The control is a type-to-search combobox, so length costs
 * the applicant nothing: they type three letters and see their subject. A
 * short list only looks tidy to whoever wrote it.
 *
 * EVERY ONE OF THE ORIGINAL 52 STRINGS IS STILL HERE, EXACTLY AS IT WAS.
 * These values are stored verbatim on member records, so renaming or
 * dropping one would leave that member's saved answer matching no option,
 * and the field would show blank next time anyone opened their profile.
 * Adding is safe; editing an existing entry is not.
 *
 * Sorted case-insensitively, with "Other" pinned last — it is the escape
 * hatch, not a suggestion. */
export const PROFESSIONS = [
  'Accounting & Finance', 'Actuarial Science', 'Administration',
  'Advertising', 'Aerospace Engineering', 'Agricultural Engineering',
  'Agriculture', 'Agriculture & Farming (Self-employed)', 'Agronomy',
  'Anaesthesia', 'Animal Science', 'Animation', 'Anthropology',
  'Aquaculture', 'Arabic', 'Archaeology', 'Architecture',
  'Artificial Intelligence / Machine Learning', 'Arts & Design',
  'Astronomy & Astrophysics', 'Audiology & Speech Therapy', 'Auditing',
  'Automotive Engineering', 'Aviation / Pilot', 'Banking',
  'Beauty & Wellness', 'Biochemistry', 'Bioinformatics', 'Biology',
  'Biomedical Engineering', 'Biotechnology',
  'Blockchain / Distributed Systems', 'Botany', 'Broadcasting',
  'Business & Management', 'Business Analytics', 'Calligraphy', 'Cardiology',
  'Ceramics', 'Chemical Engineering', 'Chemistry', 'Civil Defence',
  'Civil Engineering', 'Climate Science', 'Cloud Computing',
  'Community Development', 'Comparative Religion', 'Computer Engineering',
  'Computer Science', 'Computer Vision', 'Construction',
  'Construction Management', 'Corporate Law', 'Creative Writing',
  'Criminology', 'Culinary Arts', 'Curriculum & Instruction',
  'Customs & Excise', 'Cybersecurity', 'Dairy Science',
  'Data Science / Analytics', 'Database Administration',
  'Defence & Strategic Studies', 'Demography', 'Dentistry', 'Dermatology',
  'Development Studies', 'DevOps / Site Reliability',
  'Dietetics & Nutrition', 'Digital Media', 'Disaster Management',
  'Driving & Transport', 'E-Commerce', 'Early Childhood Education',
  'Ecology', 'Economics', 'Education / Teaching',
  'Educational Administration', 'Educational Psychology',
  'Electrical Engineering', 'Electrician', 'Electronics Engineering',
  'Emergency & Paramedical', 'Energy Engineering', 'Engineering – Other',
  'English Language & Literature', 'Entrepreneurship',
  'Environmental Engineering', 'Environmental Sciences', 'Epidemiology',
  'Fashion Design', 'Film & Television', 'Finance', 'Fine Arts',
  'Fire & Rescue Services', 'Fisheries Science', 'Food Science & Technology',
  'Forensic Science', 'Forestry', 'Game Development', 'Gender Studies',
  'General Practice', 'Genetics', 'Geography', 'Geological Engineering',
  'Geology', 'Glaciology', 'Government / Civil Service', 'Graphic Design',
  'Gynaecology & Obstetrics', 'Handicrafts', 'Health Administration',
  'Healthcare', 'Higher Education', 'History', 'Horticulture', 'Hospitality',
  'Human Resources', 'Human Rights Law', 'Human–Computer Interaction',
  'Industrial / Product Design', 'Industrial Engineering',
  'Information Systems', 'Information Technology', 'Insurance',
  'Interior Design', 'International Business', 'International Law',
  'International Relations', 'Investment & Wealth Management',
  'Islamic Banking & Finance', 'Islamic Studies', 'Journalism & Media',
  'Judiciary', 'Landscape Architecture', 'Law / Legal Services',
  'Law Enforcement / Police', 'Library & Information Science', 'Linguistics',
  'Literature', 'Logistics & Supply Chain', 'Marine Engineering',
  'Marine Science', 'Maritime / Seafaring', 'Marketing',
  'Mass Communication', 'Materials Engineering', 'Mathematics', 'Mechanic',
  'Mechanical Engineering', 'Mechatronics', 'Medical Imaging / Radiology',
  'Medical Laboratory Technology', 'Medicine / Doctor',
  'Metallurgical Engineering', 'Meteorology', 'Microbiology', 'Midwifery',
  'Military / Armed Forces', 'Mining Engineering',
  'Mobile Application Development', 'Molecular Biology', 'Music',
  'Nanotechnology', 'Network Engineering', 'Nuclear Engineering', 'Nursing',
  'Occupational Therapy', 'Oncology', 'Operations Management',
  'Ophthalmology', 'Optometry', 'Orthopaedics', 'Paediatrics', 'Pathology',
  'Peace & Conflict Studies', 'Performing Arts', 'Petroleum Engineering',
  'Pharmacy', 'Philosophy', 'Photography / Videography',
  'Physical Education', 'Physics', 'Physiotherapy', 'Plant Pathology',
  'Plumbing', 'Political Science', 'Poultry Science', 'Primary Education',
  'Project Management', 'Psychiatry', 'Psychology', 'Public Administration',
  'Public Health', 'Public Policy', 'Public Relations', 'Publishing',
  'Quality Assurance / Testing', 'Quantity Surveying', 'Quranic Studies',
  'Real Estate', 'Research / Academia', 'Retail Management', 'Robotics',
  'Rural Development', 'Science', 'Secondary Education', 'Security Services',
  'Shariah Law', 'Social Sciences', 'Social Work / NGO', 'Sociology',
  'Software Engineering', 'Soil Science', 'Special Education',
  'Sports & Athletics', 'Sports Science', 'Statistics',
  'Structural Engineering', 'Surgery', 'Surveying & Geomatics', 'Tailoring',
  'Taxation', 'Teaching', 'Technical & Vocational Education',
  'Telecommunications Engineering', 'Textile Design', 'Textile Engineering',
  'Theatre & Drama', 'Theology', 'Tourism & Travel',
  'Trade / Skilled Worker', 'Translation & Interpretation',
  'Transport & Logistics', 'UI / UX Design', 'Unani / Herbal Medicine',
  'Urban & Regional Planning', 'Urdu Language & Literature',
  'Veterinary Medicine', 'Water Resources Engineering', 'Web Development',
  'Welding', 'Zoology',
  'Other',
];

/* ── How did you hear about us? ────────────────────────────────────────────
 *
 * Asked on the application form so the committee can tell which channels
 * actually bring people in, rather than guessing from impressions.
 *
 * Deliberately short. A long list produces a long tail of one-off answers that
 * no one can act on; six buckets can be counted and compared. "Other Social
 * Media" catches Instagram, TikTok, WhatsApp groups and whatever comes next
 * without this list needing to be edited every time.
 *
 * Order is roughly by expected volume, with the two escape hatches last. */
export const HEARD_ABOUT = [
  'Facebook',
  'LinkedIn',
  'YouTube',
  'Other Social Media',
  'Referred by a Registered Member',
  'Other',
];

export const HEARD_REFERRAL = 'Referred by a Registered Member';
export const HEARD_OTHER = 'Other';

/** Does this answer need the referring member's name? */
export const needsReferrer = (v) => String(v || '').trim() === HEARD_REFERRAL;
/** Does this answer need the free-text box? */
export const needsHeardDetail = (v) => String(v || '').trim() === HEARD_OTHER;
