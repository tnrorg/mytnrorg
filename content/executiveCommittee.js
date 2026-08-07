// Central Executive Committee — the principal executive body of TNR.
//
// Fill in `name` and `qualification` for each holder as they are elected.
// Leaving `name` empty renders the card as "To Be Announced" rather than a
// blank space, so the section stays presentable between terms.
//
// Photos: /public/executive/<slug>.jpg — a missing file falls back to the
// position's monogram, so the grid never shows a broken image.

export const CEC_INTRO =
  'The Central Executive Committee is the principal executive body of TNR, responsible for implementing organisational programmes, coordinating activities, managing organisational affairs, and supporting Union Council Committees.';

export const EXECUTIVE = [
  {
    slug: 'president', designation: 'President', monogram: 'P',
    name: '', qualification: '',
    summary: 'Leads the organisation, presides at all meetings of the Committee, and represents TNR in official matters.',
    duties: [
      'Demonstrate leadership through previous involvement in community, educational, professional, social, or volunteer activities.',
      'Be capable of leading teams, coordinating activities, and representing the organisation.',
      'Present a clear vision and priorities for the organisation during the election process.',
      'Promote unity, teamwork, and constructive engagement among members.',
    ],
  },
  {
    slug: 'vice-president', designation: 'Vice President', monogram: 'VP',
    name: '', qualification: '',
    summary: 'Supports the President and acts on their behalf in their absence.',
    duties: [
      'Be capable of supporting and assisting the President.',
      'Coordinate organisational activities when required.',
      'Act on behalf of the President in their absence.',
    ],
  },
  {
    slug: 'general-secretary', designation: 'General Secretary', monogram: 'GS',
    name: '', qualification: '',
    summary: 'Manages meetings, records, documentation and correspondence for the organisation.',
    duties: [
      'Possess strong organisational and communication skills.',
      'Be able to manage meetings, records, documentation, and correspondence.',
      'Ensure effective coordination and follow-up of decisions and activities.',
    ],
  },
  {
    slug: 'information-secretary', designation: 'Information Secretary', monogram: 'IS',
    name: '', qualification: '',
    summary: 'Disseminates organisational updates, announcements and reports to the membership.',
    duties: [
      'Possess good communication and information-sharing skills.',
      'Assist in disseminating organisational updates, announcements, and reports.',
      'Promote accurate and timely communication with members.',
    ],
  },
  {
    slug: 'technical-coordinator', designation: 'Technical Coordinator', monogram: 'TC',
    name: '', qualification: '',
    summary: 'Maintains the digital platform, election portal and technical systems of TNR.',
    duties: [
      'Maintain the TNR digital platform, member portal, and election systems.',
      'Safeguard the security, availability, and integrity of organisational data.',
      'Support committees with technical tools, training, and digital infrastructure.',
      'Coordinate technical requirements for events, meetings, and online activities.',
    ],
  },
  {
    slug: 'social-media-coordinator', designation: 'Social Media Coordinator', monogram: 'SM',
    name: '', qualification: '',
    summary: 'Represents TNR responsibly and professionally across digital platforms.',
    duties: [
      'Demonstrate basic digital communication and social media management skills.',
      'Promote TNR activities responsibly and professionally on digital platforms.',
      'Uphold the organisation’s image, values, and communication standards.',
    ],
  },
];

export const execBySlug = (slug) => EXECUTIVE.find(m => m.slug === slug) || null;
