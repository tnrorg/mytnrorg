/* ── Pakistani universities and degree-awarding institutes ───────────────────
 *
 * The HEC-recognised roster, used to turn the free-text "Institution /
 * University" box on the membership form into a searchable list.
 *
 * SUGGESTIONS, NOT A WHITELIST. Members study abroad — Country Ambassadors
 * especially — so the field still accepts anything typed into it. Nobody at
 * Oxford or in Dubai is blocked by a Pakistani list, and a university chartered
 * after this file was written is typed in rather than lost.
 *
 * Gilgit-Baltistan is deliberately first. TNR is a Roundu organisation in
 * Skardu district, so Karakoram International University and Baltistan
 * University are what most applicants actually need, and they would otherwise
 * sit at the bottom of a 250-entry alphabetical list behind every university
 * in Punjab.
 *
 * `short` exists because people search by abbreviation — nobody types
 * "Karakoram International University", they type "KIU". The combobox matches
 * on it but stores the full name, so the stored value stays clean and the
 * duplicate-detection engine gets one canonical spelling instead of the
 * free-text variants it has to cope with today ("COMSATS UNIVERSITY ISLAMABAD "
 * with a trailing space is a real value in this database).
 *
 * MAINTENANCE: this is a point-in-time copy of a list that changes — new
 * universities are chartered every year. It is not authoritative and is not
 * meant to be; it is a convenience so that the common cases are spelled
 * consistently. Verify any individual institution's status with HEC directly.
 * Proposed-but-not-yet-established universities are deliberately excluded.
 *
 * Compiled November 2026.
 */

/** name, province, short (optional) */
export const PK_UNIVERSITIES = [
  // ── Gilgit-Baltistan ──────────────────────────────────────────────────────
  { id: 'karakoram-international-university', name: 'Karakoram International University', province: 'Gilgit-Baltistan', aka: ['KIU'] },
  { id: 'baltistan-university-skardu', name: 'Baltistan University, Skardu', province: 'Gilgit-Baltistan', aka: ['UOBS', 'University of Baltistan', 'University of Baltistan Skardu', 'Baltistan University'] },

  // ── Azad Jammu & Kashmir ──────────────────────────────────────────────────
  { id: 'university-of-azad-jammu-and-kashmir', name: 'University of Azad Jammu and Kashmir', province: 'AJK', aka: ['AJKU'] },
  { id: 'mirpur-university-of-science-and-technology', name: 'Mirpur University of Science and Technology', province: 'AJK', aka: ['MUST'] },
  { id: 'university-of-poonch-rawalakot', name: 'University of Poonch, Rawalakot', province: 'AJK', aka: ['UPR'] },
  { id: 'university-of-kotli', name: 'University of Kotli', province: 'AJK' },
  { id: 'women-university-of-azad-jammu-and-kashmir-bagh', name: 'Women University of Azad Jammu and Kashmir, Bagh', province: 'AJK' },
  { id: 'al-khair-university', name: 'Al-Khair University', province: 'AJK' },
  { id: 'mohi-ud-din-islamic-university', name: 'Mohi-ud-Din Islamic University', province: 'AJK' },

  // ── Islamabad ─────────────────────────────────────────────────────────────
  { id: 'quaid-i-azam-university', name: 'Quaid-i-Azam University', province: 'Islamabad', aka: ['QAU', 'Quaid-e-Azam University', 'Quaid e Azam University'] },
  { id: 'national-university-of-sciences-and-technology', name: 'National University of Sciences and Technology', province: 'Islamabad', aka: ['NUST'] },
  { id: 'comsats-university-islamabad', name: 'COMSATS University Islamabad', province: 'Islamabad', aka: ['CUI', 'COMSATS', 'COMSATS University', 'CIIT', 'COMSATS Institute of Information Technology'] },
  { id: 'international-islamic-university-islamabad', name: 'International Islamic University, Islamabad', province: 'Islamabad', aka: ['IIUI', 'IIU'] },
  { id: 'allama-iqbal-open-university', name: 'Allama Iqbal Open University', province: 'Islamabad', aka: ['AIOU'] },
  { id: 'national-university-of-modern-languages', name: 'National University of Modern Languages', province: 'Islamabad', aka: ['NUML'] },
  { id: 'virtual-university-of-pakistan', name: 'Virtual University of Pakistan', province: 'Islamabad', aka: ['VU'] },
  { id: 'pakistan-institute-of-engineering-and-applied-sciences', name: 'Pakistan Institute of Engineering and Applied Sciences', province: 'Islamabad', aka: ['PIEAS'] },
  { id: 'national-university-of-computer-and-emerging-sciences', name: 'National University of Computer and Emerging Sciences', province: 'Islamabad', aka: ['FAST', 'NUCES', 'FAST-NUCES'] },
  { id: 'air-university-islamabad', name: 'Air University, Islamabad', province: 'Islamabad' },
  { id: 'bahria-university', name: 'Bahria University', province: 'Islamabad' },
  { id: 'riphah-international-university', name: 'Riphah International University', province: 'Islamabad' },
  { id: 'capital-university-of-science-and-technology', name: 'Capital University of Science and Technology', province: 'Islamabad', aka: ['CUST'] },
  { id: 'institute-of-space-technology', name: 'Institute of Space Technology', province: 'Islamabad', aka: ['IST'] },
  { id: 'foundation-university-islamabad', name: 'Foundation University Islamabad', province: 'Islamabad' },
  { id: 'federal-urdu-university-of-arts-science-and-technology', name: 'Federal Urdu University of Arts, Science and Technology', province: 'Islamabad', aka: ['FUUAST'] },
  { id: 'national-defence-university-islamabad', name: 'National Defence University, Islamabad', province: 'Islamabad', aka: ['NDU'] },
  { id: 'national-university-of-technology', name: 'National University of Technology', province: 'Islamabad', aka: ['NUTECH'] },
  { id: 'national-skills-university-islamabad', name: 'National Skills University, Islamabad', province: 'Islamabad' },
  { id: 'pakistan-institute-of-development-economics', name: 'Pakistan Institute of Development Economics', province: 'Islamabad', aka: ['PIDE'] },
  { id: 'shaheed-zulfiqar-ali-bhutto-medical-university', name: 'Shaheed Zulfiqar Ali Bhutto Medical University', province: 'Islamabad', aka: ['SZABMU'] },
  { id: 'shifa-tameer-e-millat-university', name: 'Shifa Tameer-e-Millat University', province: 'Islamabad' },
  { id: 'sir-syed-case-institute-of-technology', name: 'Sir Syed CASE Institute of Technology', province: 'Islamabad', aka: ['CASE'] },
  { id: 'muslim-youth-university', name: 'Muslim Youth University', province: 'Islamabad' },
  { id: 'ibadat-international-university', name: 'IBADAT International University', province: 'Islamabad' },

  // ── Punjab ────────────────────────────────────────────────────────────────
  { id: 'university-of-the-punjab', name: 'University of the Punjab', province: 'Punjab', aka: ['PU', 'Punjab University', 'University of Punjab'] },
  { id: 'university-of-engineering-and-technology-lahore', name: 'University of Engineering and Technology, Lahore', province: 'Punjab', aka: ['UET Lahore'] },
  { id: 'government-college-university-lahore', name: 'Government College University, Lahore', province: 'Punjab', aka: ['GCU Lahore'] },
  { id: 'lahore-university-of-management-sciences', name: 'Lahore University of Management Sciences', province: 'Punjab', aka: ['LUMS'] },
  { id: 'king-edward-medical-university', name: 'King Edward Medical University', province: 'Punjab', aka: ['KEMU'] },
  { id: 'university-of-health-sciences-lahore', name: 'University of Health Sciences, Lahore', province: 'Punjab', aka: ['UHS'] },
  { id: 'university-of-veterinary-and-animal-sciences-lahore', name: 'University of Veterinary and Animal Sciences, Lahore', province: 'Punjab', aka: ['UVAS'] },
  { id: 'university-of-education-lahore', name: 'University of Education, Lahore', province: 'Punjab' },
  { id: 'university-of-management-and-technology-lahore', name: 'University of Management and Technology, Lahore', province: 'Punjab', aka: ['UMT'] },
  { id: 'university-of-central-punjab', name: 'University of Central Punjab', province: 'Punjab', aka: ['UCP'] },
  { id: 'university-of-lahore', name: 'University of Lahore', province: 'Punjab', aka: ['UOL'] },
  { id: 'information-technology-university-of-the-punjab', name: 'Information Technology University of the Punjab', province: 'Punjab', aka: ['ITU'] },
  { id: 'forman-christian-college-university', name: 'Forman Christian College University', province: 'Punjab', aka: ['FCCU'] },
  { id: 'kinnaird-college-for-women-university', name: 'Kinnaird College for Women University', province: 'Punjab' },
  { id: 'lahore-college-for-women-university', name: 'Lahore College for Women University', province: 'Punjab', aka: ['LCWU'] },
  { id: 'fatima-jinnah-medical-university', name: 'Fatima Jinnah Medical University', province: 'Punjab', aka: ['FJMU'] },
  { id: 'national-college-of-arts', name: 'National College of Arts', province: 'Punjab', aka: ['NCA'] },
  { id: 'national-college-of-business-administration-and-economics', name: 'National College of Business Administration and Economics', province: 'Punjab', aka: ['NCBAE'] },
  { id: 'beaconhouse-national-university', name: 'Beaconhouse National University', province: 'Punjab', aka: ['BNU'] },
  { id: 'minhaj-university-lahore', name: 'Minhaj University, Lahore', province: 'Punjab' },
  { id: 'hajvery-university', name: 'Hajvery University', province: 'Punjab' },
  { id: 'qarshi-university', name: 'Qarshi University', province: 'Punjab' },
  { id: 'superior-university-lahore', name: 'Superior University, Lahore', province: 'Punjab' },
  { id: 'university-of-south-asia', name: 'University of South Asia', province: 'Punjab' },
  { id: 'lahore-garrison-university', name: 'Lahore Garrison University', province: 'Punjab', aka: ['LGU'] },
  { id: 'lahore-school-of-economics', name: 'Lahore School of Economics', province: 'Punjab', aka: ['LSE'] },
  { id: 'university-of-home-economics-lahore', name: 'University of Home Economics, Lahore', province: 'Punjab' },
  { id: 'institute-of-management-sciences-lahore', name: 'Institute of Management Sciences, Lahore', province: 'Punjab', aka: ['Pak-AIMS'] },
  { id: 'pakistan-institute-of-fashion-and-design', name: 'Pakistan Institute of Fashion and Design', province: 'Punjab', aka: ['PIFD'] },
  { id: 'institute-for-art-and-culture-lahore', name: 'Institute for Art and Culture, Lahore', province: 'Punjab', aka: ['IAC'] },
  { id: 'punjab-tianjin-university-of-technology', name: 'Punjab Tianjin University of Technology', province: 'Punjab', aka: ['PTUT'] },
  { id: 'punjab-university-of-technology-rasul', name: 'Punjab University of Technology, Rasul', province: 'Punjab' },
  { id: 'nur-international-university', name: 'NUR International University', province: 'Punjab' },
  { id: 'green-international-university', name: 'Green International University', province: 'Punjab' },
  { id: 'rashid-latif-khan-university', name: 'Rashid Latif Khan University', province: 'Punjab' },
  { id: 'lahore-institute-of-science-and-technology', name: 'Lahore Institute of Science and Technology', province: 'Punjab' },
  { id: 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi', name: 'Pir Mehr Ali Shah Arid Agriculture University, Rawalpindi', province: 'Punjab', aka: ['PMAS-AAUR', 'UAAR', 'Arid Agriculture University'] },
  { id: 'fatima-jinnah-women-university-rawalpindi', name: 'Fatima Jinnah Women University, Rawalpindi', province: 'Punjab', aka: ['FJWU'] },
  { id: 'rawalpindi-medical-university', name: 'Rawalpindi Medical University', province: 'Punjab', aka: ['RMU'] },
  { id: 'national-university-of-medical-sciences', name: 'National University of Medical Sciences', province: 'Punjab', aka: ['NUMS'] },
  { id: 'rawalpindi-women-university', name: 'Rawalpindi Women University', province: 'Punjab' },
  { id: 'government-viqar-un-nisa-women-university-rawalpindi', name: 'Government Viqar-un-Nisa Women University, Rawalpindi', province: 'Punjab' },
  { id: 'university-of-engineering-and-technology-taxila', name: 'University of Engineering and Technology, Taxila', province: 'Punjab', aka: ['UET Taxila'] },
  { id: 'hitec-university-taxila', name: 'HITEC University, Taxila', province: 'Punjab' },
  { id: 'university-of-wah', name: 'University of Wah', province: 'Punjab', aka: ['UW'] },
  { id: 'university-of-agriculture-faisalabad', name: 'University of Agriculture, Faisalabad', province: 'Punjab', aka: ['UAF'] },
  { id: 'government-college-university-faisalabad', name: 'Government College University, Faisalabad', province: 'Punjab', aka: ['GCUF'] },
  { id: 'national-textile-university', name: 'National Textile University', province: 'Punjab', aka: ['NTU'] },
  { id: 'faisalabad-medical-university', name: 'Faisalabad Medical University', province: 'Punjab', aka: ['FMU'] },
  { id: 'university-of-faisalabad', name: 'University of Faisalabad', province: 'Punjab', aka: ['TUF'] },
  { id: 'government-college-women-university-faisalabad', name: 'Government College Women University, Faisalabad', province: 'Punjab', aka: ['GCWUF'] },
  { id: 'bahauddin-zakariya-university', name: 'Bahauddin Zakariya University', province: 'Punjab', aka: ['BZU'] },
  { id: 'nishtar-medical-university', name: 'Nishtar Medical University', province: 'Punjab' },
  { id: 'women-university-multan', name: 'Women University Multan', province: 'Punjab' },
  { id: 'emerson-university-multan', name: 'Emerson University, Multan', province: 'Punjab' },
  { id: 'muhammad-nawaz-sharif-university-of-agriculture-multan', name: 'Muhammad Nawaz Sharif University of Agriculture, Multan', province: 'Punjab', aka: ['MNSUAM'] },
  { id: 'muhammad-nawaz-sharif-university-of-engineering-and-technology-multan', name: 'Muhammad Nawaz Sharif University of Engineering and Technology, Multan', province: 'Punjab', aka: ['MNSUET'] },
  { id: 'nfc-institute-of-engineering-and-technology-multan', name: 'NFC Institute of Engineering and Technology, Multan', province: 'Punjab', aka: ['NFCIET'] },
  { id: 'institute-of-southern-punjab', name: 'Institute of Southern Punjab', province: 'Punjab', aka: ['ISP'] },
  { id: 'multan-university-of-science-and-technology', name: 'Multan University of Science and Technology', province: 'Punjab', aka: ['MUST Multan'] },
  { id: 'times-institute-multan', name: 'Times Institute, Multan', province: 'Punjab' },
  { id: 'the-islamia-university-of-bahawalpur', name: 'The Islamia University of Bahawalpur', province: 'Punjab', aka: ['IUB'] },
  { id: 'government-sadiq-college-women-university-bahawalpur', name: 'Government Sadiq College Women University, Bahawalpur', province: 'Punjab', aka: ['GSCWU'] },
  { id: 'cholistan-university-of-veterinary-and-animal-sciences', name: 'Cholistan University of Veterinary and Animal Sciences', province: 'Punjab', aka: ['CUVAS'] },
  { id: 'khawaja-fareed-university-of-engineering-and-information-technology', name: 'Khawaja Fareed University of Engineering and Information Technology', province: 'Punjab', aka: ['KFUEIT'] },
  { id: 'university-of-sargodha', name: 'University of Sargodha', province: 'Punjab', aka: ['UOS'] },
  { id: 'university-of-gujrat', name: 'University of Gujrat', province: 'Punjab', aka: ['UOG'] },
  { id: 'the-university-of-chenab', name: 'The University of Chenab', province: 'Punjab' },
  { id: 'gift-university', name: 'GIFT University', province: 'Punjab' },
  { id: 'iisat-university-gujranwala', name: 'IISAT University, Gujranwala', province: 'Punjab' },
  { id: 'international-institute-of-science-art-and-technology-gujranwala', name: 'International Institute of Science, Art and Technology, Gujranwala', province: 'Punjab' },
  { id: 'university-of-sialkot', name: 'University of Sialkot', province: 'Punjab', aka: ['USKT'] },
  { id: 'government-college-women-university-sialkot', name: 'Government College Women University, Sialkot', province: 'Punjab', aka: ['GCWUS'] },
  { id: 'grand-asian-university-sialkot', name: 'Grand Asian University, Sialkot', province: 'Punjab' },
  { id: 'ghazi-university-dera-ghazi-khan', name: 'Ghazi University, Dera Ghazi Khan', province: 'Punjab' },
  { id: 'mir-chakar-khan-rind-university-of-technology-dera-ghazi-khan', name: 'Mir Chakar Khan Rind University of Technology, Dera Ghazi Khan', province: 'Punjab' },
  { id: 'ghazi-national-institute-of-engineering-and-sciences', name: 'Ghazi National Institute of Engineering and Sciences', province: 'Punjab' },
  { id: 'university-of-sahiwal', name: 'University of Sahiwal', province: 'Punjab' },
  { id: 'university-of-okara', name: 'University of Okara', province: 'Punjab' },
  { id: 'university-of-jhang', name: 'University of Jhang', province: 'Punjab' },
  { id: 'university-of-narowal', name: 'University of Narowal', province: 'Punjab' },
  { id: 'university-of-chakwal', name: 'University of Chakwal', province: 'Punjab' },
  { id: 'university-of-mianwali', name: 'University of Mianwali', province: 'Punjab' },
  { id: 'university-of-layyah', name: 'University of Layyah', province: 'Punjab' },
  { id: 'thal-university-bhakkar', name: 'Thal University, Bhakkar', province: 'Punjab' },
  { id: 'kohsar-university-murree', name: 'Kohsar University, Murree', province: 'Punjab' },
  { id: 'namal-university-mianwali', name: 'Namal University, Mianwali', province: 'Punjab' },
  { id: 'al-qadir-university-sohawa', name: 'Al-Qadir University, Sohawa', province: 'Punjab' },
  { id: 'baba-guru-nanak-university-nankana-sahib', name: 'Baba Guru Nanak University, Nankana Sahib', province: 'Punjab' },
  { id: 'institute-of-management-and-applied-sciences-khanewal', name: 'Institute of Management and Applied Sciences, Khanewal', province: 'Punjab' },

  // ── Sindh ─────────────────────────────────────────────────────────────────
  { id: 'university-of-karachi', name: 'University of Karachi', province: 'Sindh', aka: ['KU', 'Karachi University'] },
  { id: 'ned-university-of-engineering-and-technology', name: 'NED University of Engineering and Technology', province: 'Sindh', aka: ['NED'] },
  { id: 'institute-of-business-administration-karachi', name: 'Institute of Business Administration, Karachi', province: 'Sindh', aka: ['IBA Karachi'] },
  { id: 'dow-university-of-health-sciences', name: 'Dow University of Health Sciences', province: 'Sindh', aka: ['DUHS'] },
  { id: 'aga-khan-university', name: 'Aga Khan University', province: 'Sindh', aka: ['AKU'] },
  { id: 'habib-university', name: 'Habib University', province: 'Sindh' },
  { id: 'hamdard-university', name: 'Hamdard University', province: 'Sindh' },
  { id: 'ziauddin-university', name: 'Ziauddin University', province: 'Sindh' },
  { id: 'iqra-university', name: 'Iqra University', province: 'Sindh' },
  { id: 'shaheed-zulfiqar-ali-bhutto-institute-of-science-and-technology', name: 'Shaheed Zulfiqar Ali Bhutto Institute of Science and Technology', province: 'Sindh', aka: ['SZABIST'] },
  { id: 'sir-syed-university-of-engineering-and-technology', name: 'Sir Syed University of Engineering and Technology', province: 'Sindh', aka: ['SSUET'] },
  { id: 'muhammad-ali-jinnah-university', name: 'Muhammad Ali Jinnah University', province: 'Sindh', aka: ['MAJU'] },
  { id: 'institute-of-business-management', name: 'Institute of Business Management', province: 'Sindh', aka: ['IoBM'] },
  { id: 'dawood-university-of-engineering-and-technology', name: 'Dawood University of Engineering and Technology', province: 'Sindh', aka: ['DUET'] },
  { id: 'jinnah-sindh-medical-university', name: 'Jinnah Sindh Medical University', province: 'Sindh', aka: ['JSMU'] },
  { id: 'sindh-madressatul-islam-university', name: 'Sindh Madressatul Islam University', province: 'Sindh', aka: ['SMIU'] },
  { id: 'jinnah-university-for-women', name: 'Jinnah University for Women', province: 'Sindh', aka: ['JUW'] },
  { id: 'dha-suffa-university', name: 'DHA Suffa University', province: 'Sindh', aka: ['DSU'] },
  { id: 'baqai-medical-university', name: 'Baqai Medical University', province: 'Sindh' },
  { id: 'indus-valley-school-of-art-and-architecture', name: 'Indus Valley School of Art and Architecture', province: 'Sindh', aka: ['IVS'] },
  { id: 'textile-institute-of-pakistan', name: 'Textile Institute of Pakistan', province: 'Sindh', aka: ['TIP'] },
  { id: 'karachi-institute-of-economics-and-technology', name: 'Karachi Institute of Economics and Technology', province: 'Sindh', aka: ['KIET'] },
  { id: 'karachi-school-for-business-and-leadership', name: 'Karachi School for Business and Leadership', province: 'Sindh', aka: ['KSBL'] },
  { id: 'karachi-institute-of-technology-and-entrepreneurship', name: 'Karachi Institute of Technology and Entrepreneurship', province: 'Sindh', aka: ['KITE'] },
  { id: 'karachi-institute-of-power-engineering', name: 'Karachi Institute of Power Engineering', province: 'Sindh', aka: ['KINPOE'] },
  { id: 'greenwich-university-karachi', name: 'Greenwich University, Karachi', province: 'Sindh' },
  { id: 'indus-university-karachi', name: 'Indus University, Karachi', province: 'Sindh' },
  { id: 'ilma-university', name: 'Ilma University', province: 'Sindh' },
  { id: 'preston-university-karachi', name: 'Preston University, Karachi', province: 'Sindh' },
  { id: 'dadabhoy-institute-of-higher-education', name: 'Dadabhoy Institute of Higher Education', province: 'Sindh' },
  { id: 'nazeer-hussain-university', name: 'Nazeer Hussain University', province: 'Sindh' },
  { id: 'salim-habib-university', name: 'Salim Habib University', province: 'Sindh' },
  { id: 'sohail-university', name: 'Sohail University', province: 'Sindh' },
  { id: 'malir-university-of-science-and-technology', name: 'Malir University of Science and Technology', province: 'Sindh' },
  { id: 'emaan-institute-of-management-and-sciences', name: 'Emaan Institute of Management and Sciences', province: 'Sindh' },
  { id: 'millennium-institute-of-technology-and-entrepreneurship', name: 'Millennium Institute of Technology and Entrepreneurship', province: 'Sindh' },
  { id: 'commecs-institute-of-business-and-emerging-sciences', name: 'Commecs Institute of Business and Emerging Sciences', province: 'Sindh' },
  { id: 'kasb-institute-of-technology', name: 'KASB Institute of Technology', province: 'Sindh' },
  { id: 'newports-institute-of-communications-and-economics', name: 'Newports Institute of Communications and Economics', province: 'Sindh' },
  { id: 'sindh-institute-of-medical-sciences', name: 'Sindh Institute of Medical Sciences', province: 'Sindh' },
  { id: 'city-university-of-health-sciences-karachi', name: 'City University of Health Sciences, Karachi', province: 'Sindh' },
  { id: 'benazir-bhutto-shaheed-university-karachi', name: 'Benazir Bhutto Shaheed University, Karachi', province: 'Sindh' },
  { id: 'shaheed-benazir-bhutto-city-university-karachi', name: 'Shaheed Benazir Bhutto City University, Karachi', province: 'Sindh' },
  { id: 'shaheed-benazir-bhutto-dewan-university', name: 'Shaheed Benazir Bhutto Dewan University', province: 'Sindh' },
  { id: 'shaheed-zulfiqar-ali-bhutto-university-of-law', name: 'Shaheed Zulfiqar Ali Bhutto University of Law', province: 'Sindh', aka: ['SZABUL'] },
  { id: 'qalandar-shahbaz-university-of-modern-sciences', name: 'Qalandar Shahbaz University of Modern Sciences', province: 'Sindh' },
  { id: 'university-of-sindh-jamshoro', name: 'University of Sindh, Jamshoro', province: 'Sindh', aka: ['USindh'] },
  { id: 'mehran-university-of-engineering-and-technology', name: 'Mehran University of Engineering and Technology', province: 'Sindh', aka: ['MUET'] },
  { id: 'liaquat-university-of-medical-and-health-sciences', name: 'Liaquat University of Medical and Health Sciences', province: 'Sindh', aka: ['LUMHS'] },
  { id: 'sindh-agriculture-university-tandojam', name: 'Sindh Agriculture University, Tandojam', province: 'Sindh', aka: ['SAU'] },
  { id: 'government-college-university-hyderabad', name: 'Government College University, Hyderabad', province: 'Sindh' },
  { id: 'isra-university-hyderabad', name: 'Isra University, Hyderabad', province: 'Sindh' },
  { id: 'university-of-east-hyderabad', name: 'University of EAST, Hyderabad', province: 'Sindh' },
  { id: 'hyderabad-institute-for-technical-and-management-sciences', name: 'Hyderabad Institute for Technical and Management Sciences', province: 'Sindh' },
  { id: 'university-of-art-and-culture-jamshoro', name: 'University of Art and Culture, Jamshoro', province: 'Sindh' },
  { id: 'shaheed-allah-bux-soomro-university-of-art-design-and-heritages', name: 'Shaheed Allah Bux Soomro University of Art, Design and Heritages', province: 'Sindh' },
  { id: 'shah-abdul-latif-university-khairpur', name: 'Shah Abdul Latif University, Khairpur', province: 'Sindh', aka: ['SALU'] },
  { id: 'sukkur-iba-university', name: 'Sukkur IBA University', province: 'Sindh', aka: ['IBA Sukkur'] },
  { id: 'quaid-e-awam-university-of-engineering-science-and-technology', name: 'Quaid-e-Awam University of Engineering, Science and Technology', province: 'Sindh', aka: ['QUEST'] },
  { id: 'shaheed-benazir-bhutto-university-benazirabad', name: 'Shaheed Benazir Bhutto University, Benazirabad', province: 'Sindh', aka: ['SBBU'] },
  { id: 'peoples-university-of-medical-and-health-sciences-for-women', name: 'Peoples University of Medical and Health Sciences for Women', province: 'Sindh', aka: ['PUMHS'] },
  { id: 'shaheed-benazir-bhutto-university-of-veterinary-and-animal-sciences', name: 'Shaheed Benazir Bhutto University of Veterinary and Animal Sciences', province: 'Sindh', aka: ['SBBUVAS'] },
  { id: 'shaheed-mohtarma-benazir-bhutto-medical-university-larkana', name: 'Shaheed Mohtarma Benazir Bhutto Medical University, Larkana', province: 'Sindh', aka: ['SMBBMU'] },
  { id: 'university-of-larkano', name: 'University of Larkano', province: 'Sindh' },
  { id: 'begum-nusrat-bhutto-women-university-sukkur', name: 'Begum Nusrat Bhutto Women University, Sukkur', province: 'Sindh' },
  { id: 'aror-university-of-art-architecture-design-and-heritage', name: 'Aror University of Art, Architecture, Design and Heritage', province: 'Sindh' },
  { id: 'the-shaikh-ayaz-university-shikarpur', name: 'The Shaikh Ayaz University, Shikarpur', province: 'Sindh' },
  { id: 'pir-abdul-qadir-shah-jeelani-institute-of-medical-sciences', name: 'Pir Abdul Qadir Shah Jeelani Institute of Medical Sciences', province: 'Sindh' },
  { id: 'benazir-bhutto-shaheed-university-of-technology-and-skill-development', name: 'Benazir Bhutto Shaheed University of Technology and Skill Development', province: 'Sindh' },
  { id: 'university-of-sufism-and-modern-sciences-bhit-shah', name: 'University of Sufism and Modern Sciences, Bhit Shah', province: 'Sindh' },

  // ── Khyber Pakhtunkhwa ────────────────────────────────────────────────────
  { id: 'university-of-peshawar', name: 'University of Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['UOP', 'Peshawar University'] },
  { id: 'university-of-engineering-and-technology-peshawar', name: 'University of Engineering and Technology, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['UET Peshawar'] },
  { id: 'islamia-college-university-peshawar', name: 'Islamia College University, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['ICP'] },
  { id: 'khyber-medical-university', name: 'Khyber Medical University', province: 'Khyber Pakhtunkhwa', aka: ['KMU'] },
  { id: 'university-of-agriculture-peshawar', name: 'University of Agriculture, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { id: 'institute-of-management-sciences-peshawar', name: 'Institute of Management Sciences, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['IMSciences'] },
  { id: 'ghulam-ishaq-khan-institute-of-engineering-sciences-and-technology', name: 'Ghulam Ishaq Khan Institute of Engineering Sciences and Technology', province: 'Khyber Pakhtunkhwa', aka: ['GIKI'] },
  { id: 'abdul-wali-khan-university-mardan', name: 'Abdul Wali Khan University, Mardan', province: 'Khyber Pakhtunkhwa', aka: ['AWKUM'] },
  { id: 'hazara-university-mansehra', name: 'Hazara University, Mansehra', province: 'Khyber Pakhtunkhwa' },
  { id: 'kohat-university-of-science-and-technology', name: 'Kohat University of Science and Technology', province: 'Khyber Pakhtunkhwa', aka: ['KUST'] },
  { id: 'gomal-university-dera-ismail-khan', name: 'Gomal University, Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-malakand', name: 'University of Malakand', province: 'Khyber Pakhtunkhwa', aka: ['UOM'] },
  { id: 'university-of-swat', name: 'University of Swat', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-haripur', name: 'University of Haripur', province: 'Khyber Pakhtunkhwa', aka: ['UOH'] },
  { id: 'university-of-swabi', name: 'University of Swabi', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-buner', name: 'University of Buner', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-chitral', name: 'University of Chitral', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-dir-timergara', name: 'University of Dir, Timergara', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-shangla', name: 'University of Shangla', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-lakki-marwat', name: 'University of Lakki Marwat', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-science-and-technology-bannu', name: 'University of Science and Technology, Bannu', province: 'Khyber Pakhtunkhwa', aka: ['USTB'] },
  { id: 'bacha-khan-university-charsadda', name: 'Bacha Khan University, Charsadda', province: 'Khyber Pakhtunkhwa', aka: ['BKUC'] },
  { id: 'khushal-khan-khattak-university-karak', name: 'Khushal Khan Khattak University, Karak', province: 'Khyber Pakhtunkhwa', aka: ['KKKUK'] },
  { id: 'abbottabad-university-of-science-and-technology', name: 'Abbottabad University of Science and Technology', province: 'Khyber Pakhtunkhwa', aka: ['AUST'] },
  { id: 'shaheed-benazir-bhutto-university-sheringal', name: 'Shaheed Benazir Bhutto University, Sheringal', province: 'Khyber Pakhtunkhwa', aka: ['SBBU Sheringal'] },
  { id: 'shaheed-benazir-bhutto-women-university-peshawar', name: 'Shaheed Benazir Bhutto Women University, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['SBBWU'] },
  { id: 'women-university-mardan', name: 'Women University, Mardan', province: 'Khyber Pakhtunkhwa' },
  { id: 'women-university-swabi', name: 'Women University, Swabi', province: 'Khyber Pakhtunkhwa' },
  { id: 'fata-university', name: 'FATA University', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-engineering-and-technology-mardan', name: 'University of Engineering and Technology, Mardan', province: 'Khyber Pakhtunkhwa', aka: ['UET Mardan'] },
  { id: 'university-of-agriculture-dera-ismail-khan', name: 'University of Agriculture, Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { id: 'university-of-technology-nowshera', name: 'University of Technology, Nowshera', province: 'Khyber Pakhtunkhwa', aka: ['UOTN'] },
  { id: 'university-of-engineering-and-applied-sciences-swat', name: 'University of Engineering and Applied Sciences, Swat', province: 'Khyber Pakhtunkhwa', aka: ['UEAS'] },
  { id: 'university-of-veterinary-and-animal-sciences-swat', name: 'University of Veterinary and Animal Sciences, Swat', province: 'Khyber Pakhtunkhwa' },
  { id: 'pak-austria-fachhochschule-institute-of-applied-sciences-and-technology', name: 'Pak-Austria Fachhochschule: Institute of Applied Sciences and Technology', province: 'Khyber Pakhtunkhwa', aka: ['PAF-IAST'] },
  { id: 'cecos-university-of-information-technology-and-emerging-sciences', name: 'CECOS University of Information Technology and Emerging Sciences', province: 'Khyber Pakhtunkhwa', aka: ['CECOS'] },
  { id: 'city-university-of-science-and-information-technology-peshawar', name: 'City University of Science and Information Technology, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['CUSIT'] },
  { id: 'sarhad-university-of-science-and-information-technology', name: 'Sarhad University of Science and Information Technology', province: 'Khyber Pakhtunkhwa', aka: ['SUIT'] },
  { id: 'iqra-national-university-peshawar', name: 'IQRA National University, Peshawar', province: 'Khyber Pakhtunkhwa', aka: ['INU'] },
  { id: 'abasyn-university-peshawar', name: 'Abasyn University, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { id: 'gandhara-university-peshawar', name: 'Gandhara University, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { id: 'qurtuba-university-of-science-and-information-technology', name: 'Qurtuba University of Science and Information Technology', province: 'Khyber Pakhtunkhwa' },
  { id: 'northern-university-nowshera', name: 'Northern University, Nowshera', province: 'Khyber Pakhtunkhwa' },
  { id: 'preston-university-kohat', name: 'Preston University, Kohat', province: 'Khyber Pakhtunkhwa' },

  // ── Balochistan ───────────────────────────────────────────────────────────
  { id: 'university-of-balochistan', name: 'University of Balochistan', province: 'Balochistan', aka: ['UOB'] },
  { id: 'balochistan-university-of-information-technology-engineering-and-management-sciences', name: 'Balochistan University of Information Technology, Engineering and Management Sciences', province: 'Balochistan', aka: ['BUITEMS'] },
  { id: 'balochistan-university-of-engineering-and-technology-khuzdar', name: 'Balochistan University of Engineering and Technology, Khuzdar', province: 'Balochistan', aka: ['BUET Khuzdar'] },
  { id: 'bolan-university-of-medical-and-health-sciences', name: 'Bolan University of Medical and Health Sciences', province: 'Balochistan', aka: ['BUMHS'] },
  { id: 'sardar-bahadur-khan-womens-university', name: 'Sardar Bahadur Khan Women’s University', province: 'Balochistan', aka: ['SBKWU'] },
  { id: 'lasbela-university-of-agriculture-water-and-marine-sciences', name: 'Lasbela University of Agriculture, Water and Marine Sciences', province: 'Balochistan', aka: ['LUAWMS'] },
  { id: 'university-of-turbat', name: 'University of Turbat', province: 'Balochistan', aka: ['UOT'] },
  { id: 'university-of-loralai', name: 'University of Loralai', province: 'Balochistan' },
  { id: 'university-of-gwadar', name: 'University of Gwadar', province: 'Balochistan' },
  { id: 'university-of-makran-panjgur', name: 'University of Makran, Panjgur', province: 'Balochistan' },
  { id: 'mir-chakar-khan-rind-university-sibi', name: 'Mir Chakar Khan Rind University, Sibi', province: 'Balochistan' },
  { id: 'al-hamd-islamic-university', name: 'Al-Hamd Islamic University', province: 'Balochistan' },

  // ── Federal / military academies ──────────────────────────────────────────
  { id: 'pakistan-military-academy-kakul', name: 'Pakistan Military Academy, Kakul', province: 'Federal' },
  { id: 'pakistan-air-force-academy-risalpur', name: 'Pakistan Air Force Academy, Risalpur', province: 'Federal' },
  { id: 'pakistan-naval-academy-karachi', name: 'Pakistan Naval Academy, Karachi', province: 'Federal' },
];

/** Plain names, in list order (Gilgit-Baltistan first). */
export const PK_UNIVERSITY_NAMES = PK_UNIVERSITIES.map(u => u.name);

/* Combobox options: the stored value is the full name, but typing an
 * abbreviation or a province finds it. `keywords` never reaches the database.
 * Search is deliberately GENEROUS — it only suggests, a person picks. */
export const PK_UNIVERSITY_OPTIONS = PK_UNIVERSITIES.map(u => ({
  value: u.name,
  keywords: `${(u.aka || []).join(' ')} ${u.province}`,
}));

/* ── Matching typed text to a university ID ────────────────────────────────
 *
 * Unlike search, MATCHING IS DELIBERATELY STRICT, because a match decides who
 * can see a member. Mapping somebody to the wrong university hands their
 * record to a stranger at another institution; failing to map them only
 * leaves them in the admin's "unmatched" queue for a human to resolve. So
 * every rule below errs towards "no match".
 *
 *  1. Exact, after normalisation. No fuzzy matching at all: "COMSAT" with a
 *     typo is unmatched, not "probably COMSATS".
 *  2. An alias that could mean two universities means neither. "UET" is four
 *     universities, "IBA" two, "Preston University" two — all unmatched.
 *  3. Short codes (three letters or fewer) count only if they are on a short
 *     list of codes that are unambiguous in practice. "UOS" is Sargodha to
 *     one person and Sialkot, Sindh or Swat to the next; "PU" is Punjab to
 *     most people and Peshawar to some. Neither is safe to act on.
 *
 * `normUni` MUST stay byte-for-byte equivalent to tnr_norm_university() in
 * supabase/migration_university_ambassadors_portal.sql — the database trigger
 * does the live mapping and this does the seed and the preview. The test
 * harness checks the two against each other on a real Postgres.
 *
 * This file is the source for the SEED. After the migration has run, the
 * database tables are authoritative: admins can add universities and
 * campuses there that this file has never heard of. */

export function normUni(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/* Codes of three characters or fewer that are allowed to match on their own.
 * Each is the established short name of exactly one institution. Anything
 * not here still helps SEARCH (the combobox) but never decides a mapping. */
const TRUSTED_SHORT = new Set(['kiu', 'qau', 'cui', 'ned', 'aku', 'bzu', 'iub', 'uaf',
  'uhs', 'umt', 'ucp', 'itu', 'kmu', 'juw']);

/* Longer codes that are nonetheless used for more than one institution. */
const AMBIGUOUS = new Set(['sbbu', 'must', 'kite']);

/** Every (normalised alias → university id) pair, with ambiguous aliases removed. */
export function universityAliasPairs(list = PK_UNIVERSITIES) {
  const seen = new Map();                       // alias → Set(ids)
  const add = (alias, id) => {
    const a = normUni(alias);
    if (!a || a.length < 2) return;
    if (!seen.has(a)) seen.set(a, new Set());
    seen.get(a).add(id);
  };

  for (const u of list) {
    add(u.name, u.id);
    /* "University of Sindh, Jamshoro" is usually typed without the city. The
       base name is added too, and rule 2 discards it where two campuses or
       two universities share it ("Preston University"). */
    const comma = u.name.lastIndexOf(',');
    if (comma > 0) add(u.name.slice(0, comma), u.id);

    for (const code of u.aka || []) {
      const c = normUni(code);
      if (AMBIGUOUS.has(c)) continue;
      if (c.replace(/ /g, '').length <= 3 && !TRUSTED_SHORT.has(c)) continue;
      add(code, u.id);
    }
  }

  const out = [];
  for (const [alias, ids] of seen) if (ids.size === 1) out.push([alias, [...ids][0]]);
  return out;
}

const ALIAS = new Map(universityAliasPairs());
const BY_ID = new Map(PK_UNIVERSITIES.map(u => [u.id, u]));

/** Typed text → university id, or null when there is no SAFE match. */
export function resolveUniversityId(value) {
  const k = normUni(value);
  return k ? (ALIAS.get(k) || null) : null;
}

export const universityById = (id) => BY_ID.get(id) || null;

/**
 * Typed text → the canonical full name, or the input unchanged.
 * "KIU" → "Karakoram International University"; "Oxford" → "Oxford".
 *
 * Same strict rules as resolveUniversityId, so "UET" and "Lahore" both come
 * back exactly as typed rather than being guessed at.
 */
export function expandUniversity(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const id = resolveUniversityId(v);
  return id ? BY_ID.get(id).name : v;
}
