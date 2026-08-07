// Interim Advisory Council of Tehreek-e-Nojawanan Roundu.
// Photos live in /public/advisory/<slug>.jpg — until a photo is added the card
// falls back to the member's initials, so a missing file never breaks the page.

export const COUNCIL_TAGLINE = 'Uniting Knowledge, Experience & Passion for a Stronger Roundu';

export const COUNCIL_MISSION =
  'To guide Tehreek-e-Nojawanan Roundu with wisdom, integrity and diverse expertise; empowering youth, promoting knowledge, advancing sustainability, and building a peaceful, inclusive and prosperous future for Roundu.';

export const COUNCIL_PILLARS = [
  ['🎓', 'Education for All'], ['🕊️', 'Peace & Harmony'], ['🌿', 'Climate Action'],
  ['👥', 'Youth Empowerment'], ['🤝', 'Community Development'], ['⚖️', 'Integrity & Good Governance'],
];

export const COUNCIL = [
  {
    slug: 'ali-shahid', name: 'Dr. Ali Shahid', degree: 'PhD', field: 'Climate & Energy Policy',
    affiliation: 'The Australian National University (ANU), Australia',
    expertise: ['Climate Policy', 'Energy Transition', 'Decarbonisation', 'Sustainable Development', 'Public Policy'],
  },
  {
    slug: 'nasir-elahi', name: 'Dr. Nasir Elahi', degree: 'PhD', field: 'Chemistry',
    affiliation: 'Huazhong University of Science and Technology (HUST), China',
    expertise: ['Pharmaceutical Analysis', 'Analytical Chemistry', 'Drug Discovery', 'Quality Control', 'Scientific Research'],
  },
  {
    slug: 'sartaj-ahmed', name: 'Dr. Sartaj Ahmed', degree: 'PhD', field: 'Computer Science',
    affiliation: 'University of Turku, Finland',
    expertise: ['Computer Science', 'Artificial Intelligence', 'Research & Innovation', 'Software Systems', 'Digital Technologies'],
  },
  {
    slug: 'zaheer-abbas-akhonzadah', name: 'Dr. Zaheer Abbas Akhonzadah', degree: 'PhD', field: 'Plant Sciences',
    affiliation: 'Assistant Professor, University of Education Lahore',
    expertise: ['Plant Ecology', 'Ethnobiology', 'Medicinal Plants', 'Biodiversity and Conservation', 'Climate Change'],
  },
  {
    slug: 'wajahat-mir-alvi', name: 'Wajahat Mir Alvi', degree: 'PhD Scholar', field: 'History',
    affiliation: 'Government College University Faisalabad (GCUF)',
    expertise: ['Political History', 'Administrative History', 'Gilgit-Baltistan Studies', 'British Colonial Administration', 'Parliamentary Development'],
  },
  {
    slug: 'roheena-ali-shah', name: 'Roheena Ali Shah', degree: 'Masters', field: 'Gender Studies',
    affiliation: 'Gender Specialist',
    expertise: ['Gender Equality', "Women's Empowerment", 'Social Inclusion', 'Community Development', 'Human Rights'],
  },
  {
    slug: 'syed-muntazir-kazmi', name: 'Syed Muntazir Kazmi', degree: 'Commerce Graduate', field: '',
    affiliation: 'SDG-focused Social Organizations',
    expertise: ['Accounting & Finance', 'Organizational Management', 'Mentorship', 'Education', 'Peacebuilding', 'Climate Action'],
  },
];

export const bySlug = (slug) => COUNCIL.find(m => m.slug === slug) || null;
export const initials = (name) =>
  name.replace(/^(Dr\.|Syed|Mr\.|Ms\.)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
