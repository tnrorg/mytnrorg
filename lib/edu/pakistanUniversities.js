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
  { name: 'Karakoram International University', province: 'Gilgit-Baltistan', short: 'KIU' },
  { name: 'Baltistan University, Skardu', province: 'Gilgit-Baltistan', short: 'UOBS' },

  // ── Azad Jammu & Kashmir ──────────────────────────────────────────────────
  { name: 'University of Azad Jammu and Kashmir', province: 'AJK', short: 'AJKU' },
  { name: 'Mirpur University of Science and Technology', province: 'AJK', short: 'MUST' },
  { name: 'University of Poonch, Rawalakot', province: 'AJK', short: 'UPR' },
  { name: 'University of Kotli', province: 'AJK' },
  { name: 'Women University of Azad Jammu and Kashmir, Bagh', province: 'AJK' },
  { name: 'Al-Khair University', province: 'AJK' },
  { name: 'Mohi-ud-Din Islamic University', province: 'AJK' },

  // ── Islamabad ─────────────────────────────────────────────────────────────
  { name: 'Quaid-i-Azam University', province: 'Islamabad', short: 'QAU' },
  { name: 'National University of Sciences and Technology', province: 'Islamabad', short: 'NUST' },
  { name: 'COMSATS University Islamabad', province: 'Islamabad', short: 'CUI COMSATS' },
  { name: 'International Islamic University, Islamabad', province: 'Islamabad', short: 'IIUI IIU' },
  { name: 'Allama Iqbal Open University', province: 'Islamabad', short: 'AIOU' },
  { name: 'National University of Modern Languages', province: 'Islamabad', short: 'NUML' },
  { name: 'Virtual University of Pakistan', province: 'Islamabad', short: 'VU' },
  { name: 'Pakistan Institute of Engineering and Applied Sciences', province: 'Islamabad', short: 'PIEAS' },
  { name: 'National University of Computer and Emerging Sciences', province: 'Islamabad', short: 'FAST NUCES' },
  { name: 'Air University, Islamabad', province: 'Islamabad' },
  { name: 'Bahria University', province: 'Islamabad' },
  { name: 'Riphah International University', province: 'Islamabad' },
  { name: 'Capital University of Science and Technology', province: 'Islamabad', short: 'CUST' },
  { name: 'Institute of Space Technology', province: 'Islamabad', short: 'IST' },
  { name: 'Foundation University Islamabad', province: 'Islamabad' },
  { name: 'Federal Urdu University of Arts, Science and Technology', province: 'Islamabad', short: 'FUUAST' },
  { name: 'National Defence University, Islamabad', province: 'Islamabad', short: 'NDU' },
  { name: 'National University of Technology', province: 'Islamabad', short: 'NUTECH' },
  { name: 'National Skills University, Islamabad', province: 'Islamabad' },
  { name: 'Pakistan Institute of Development Economics', province: 'Islamabad', short: 'PIDE' },
  { name: 'Shaheed Zulfiqar Ali Bhutto Medical University', province: 'Islamabad', short: 'SZABMU' },
  { name: 'Shifa Tameer-e-Millat University', province: 'Islamabad' },
  { name: 'Sir Syed CASE Institute of Technology', province: 'Islamabad', short: 'CASE' },
  { name: 'Muslim Youth University', province: 'Islamabad' },
  { name: 'IBADAT International University', province: 'Islamabad' },

  // ── Punjab ────────────────────────────────────────────────────────────────
  { name: 'University of the Punjab', province: 'Punjab', short: 'PU' },
  { name: 'University of Engineering and Technology, Lahore', province: 'Punjab', short: 'UET Lahore' },
  { name: 'Government College University, Lahore', province: 'Punjab', short: 'GCU Lahore' },
  { name: 'Lahore University of Management Sciences', province: 'Punjab', short: 'LUMS' },
  { name: 'King Edward Medical University', province: 'Punjab', short: 'KEMU' },
  { name: 'University of Health Sciences, Lahore', province: 'Punjab', short: 'UHS' },
  { name: 'University of Veterinary and Animal Sciences, Lahore', province: 'Punjab', short: 'UVAS' },
  { name: 'University of Education, Lahore', province: 'Punjab' },
  { name: 'University of Management and Technology, Lahore', province: 'Punjab', short: 'UMT' },
  { name: 'University of Central Punjab', province: 'Punjab', short: 'UCP' },
  { name: 'University of Lahore', province: 'Punjab', short: 'UOL' },
  { name: 'Information Technology University of the Punjab', province: 'Punjab', short: 'ITU' },
  { name: 'Forman Christian College University', province: 'Punjab', short: 'FCCU' },
  { name: 'Kinnaird College for Women University', province: 'Punjab' },
  { name: 'Lahore College for Women University', province: 'Punjab', short: 'LCWU' },
  { name: 'Fatima Jinnah Medical University', province: 'Punjab', short: 'FJMU' },
  { name: 'National College of Arts', province: 'Punjab', short: 'NCA' },
  { name: 'National College of Business Administration and Economics', province: 'Punjab', short: 'NCBAE' },
  { name: 'Beaconhouse National University', province: 'Punjab', short: 'BNU' },
  { name: 'Minhaj University, Lahore', province: 'Punjab' },
  { name: 'Hajvery University', province: 'Punjab' },
  { name: 'Qarshi University', province: 'Punjab' },
  { name: 'Superior University, Lahore', province: 'Punjab' },
  { name: 'University of South Asia', province: 'Punjab' },
  { name: 'Lahore Garrison University', province: 'Punjab', short: 'LGU' },
  { name: 'Lahore School of Economics', province: 'Punjab', short: 'LSE' },
  { name: 'University of Home Economics, Lahore', province: 'Punjab' },
  { name: 'Institute of Management Sciences, Lahore', province: 'Punjab', short: 'Pak-AIMS' },
  { name: 'Pakistan Institute of Fashion and Design', province: 'Punjab', short: 'PIFD' },
  { name: 'Institute for Art and Culture, Lahore', province: 'Punjab', short: 'IAC' },
  { name: 'Punjab Tianjin University of Technology', province: 'Punjab', short: 'PTUT' },
  { name: 'Punjab University of Technology, Rasul', province: 'Punjab' },
  { name: 'NUR International University', province: 'Punjab' },
  { name: 'Green International University', province: 'Punjab' },
  { name: 'Rashid Latif Khan University', province: 'Punjab' },
  { name: 'Lahore Institute of Science and Technology', province: 'Punjab' },
  { name: 'Pir Mehr Ali Shah Arid Agriculture University, Rawalpindi', province: 'Punjab', short: 'PMAS UAAR' },
  { name: 'Fatima Jinnah Women University, Rawalpindi', province: 'Punjab', short: 'FJWU' },
  { name: 'Rawalpindi Medical University', province: 'Punjab', short: 'RMU' },
  { name: 'National University of Medical Sciences', province: 'Punjab', short: 'NUMS' },
  { name: 'Rawalpindi Women University', province: 'Punjab' },
  { name: 'Government Viqar-un-Nisa Women University, Rawalpindi', province: 'Punjab' },
  { name: 'University of Engineering and Technology, Taxila', province: 'Punjab', short: 'UET Taxila' },
  { name: 'HITEC University, Taxila', province: 'Punjab' },
  { name: 'University of Wah', province: 'Punjab', short: 'UW' },
  { name: 'University of Agriculture, Faisalabad', province: 'Punjab', short: 'UAF' },
  { name: 'Government College University, Faisalabad', province: 'Punjab', short: 'GCUF' },
  { name: 'National Textile University', province: 'Punjab', short: 'NTU' },
  { name: 'Faisalabad Medical University', province: 'Punjab', short: 'FMU' },
  { name: 'University of Faisalabad', province: 'Punjab', short: 'TUF' },
  { name: 'Government College Women University, Faisalabad', province: 'Punjab', short: 'GCWUF' },
  { name: 'Bahauddin Zakariya University', province: 'Punjab', short: 'BZU' },
  { name: 'Nishtar Medical University', province: 'Punjab' },
  { name: 'Women University Multan', province: 'Punjab' },
  { name: 'Emerson University, Multan', province: 'Punjab' },
  { name: 'Muhammad Nawaz Sharif University of Agriculture, Multan', province: 'Punjab', short: 'MNSUAM' },
  { name: 'Muhammad Nawaz Sharif University of Engineering and Technology, Multan', province: 'Punjab', short: 'MNSUET' },
  { name: 'NFC Institute of Engineering and Technology, Multan', province: 'Punjab', short: 'NFCIET' },
  { name: 'Institute of Southern Punjab', province: 'Punjab', short: 'ISP' },
  { name: 'Multan University of Science and Technology', province: 'Punjab', short: 'MUST Multan' },
  { name: 'Times Institute, Multan', province: 'Punjab' },
  { name: 'The Islamia University of Bahawalpur', province: 'Punjab', short: 'IUB' },
  { name: 'Government Sadiq College Women University, Bahawalpur', province: 'Punjab', short: 'GSCWU' },
  { name: 'Cholistan University of Veterinary and Animal Sciences', province: 'Punjab', short: 'CUVAS' },
  { name: 'Khawaja Fareed University of Engineering and Information Technology', province: 'Punjab', short: 'KFUEIT' },
  { name: 'University of Sargodha', province: 'Punjab', short: 'UOS' },
  { name: 'University of Gujrat', province: 'Punjab', short: 'UOG' },
  { name: 'The University of Chenab', province: 'Punjab' },
  { name: 'GIFT University', province: 'Punjab' },
  { name: 'IISAT University, Gujranwala', province: 'Punjab' },
  { name: 'International Institute of Science, Art and Technology, Gujranwala', province: 'Punjab' },
  { name: 'University of Sialkot', province: 'Punjab', short: 'USKT' },
  { name: 'Government College Women University, Sialkot', province: 'Punjab', short: 'GCWUS' },
  { name: 'Grand Asian University, Sialkot', province: 'Punjab' },
  { name: 'Ghazi University, Dera Ghazi Khan', province: 'Punjab' },
  { name: 'Mir Chakar Khan Rind University of Technology, Dera Ghazi Khan', province: 'Punjab' },
  { name: 'Ghazi National Institute of Engineering and Sciences', province: 'Punjab' },
  { name: 'University of Sahiwal', province: 'Punjab' },
  { name: 'University of Okara', province: 'Punjab' },
  { name: 'University of Jhang', province: 'Punjab' },
  { name: 'University of Narowal', province: 'Punjab' },
  { name: 'University of Chakwal', province: 'Punjab' },
  { name: 'University of Mianwali', province: 'Punjab' },
  { name: 'University of Layyah', province: 'Punjab' },
  { name: 'Thal University, Bhakkar', province: 'Punjab' },
  { name: 'Kohsar University, Murree', province: 'Punjab' },
  { name: 'Namal University, Mianwali', province: 'Punjab' },
  { name: 'Al-Qadir University, Sohawa', province: 'Punjab' },
  { name: 'Baba Guru Nanak University, Nankana Sahib', province: 'Punjab' },
  { name: 'Institute of Management and Applied Sciences, Khanewal', province: 'Punjab' },

  // ── Sindh ─────────────────────────────────────────────────────────────────
  { name: 'University of Karachi', province: 'Sindh', short: 'KU' },
  { name: 'NED University of Engineering and Technology', province: 'Sindh', short: 'NED' },
  { name: 'Institute of Business Administration, Karachi', province: 'Sindh', short: 'IBA Karachi' },
  { name: 'Dow University of Health Sciences', province: 'Sindh', short: 'DUHS' },
  { name: 'Aga Khan University', province: 'Sindh', short: 'AKU' },
  { name: 'Habib University', province: 'Sindh' },
  { name: 'Hamdard University', province: 'Sindh' },
  { name: 'Ziauddin University', province: 'Sindh' },
  { name: 'Iqra University', province: 'Sindh' },
  { name: 'Shaheed Zulfiqar Ali Bhutto Institute of Science and Technology', province: 'Sindh', short: 'SZABIST' },
  { name: 'Sir Syed University of Engineering and Technology', province: 'Sindh', short: 'SSUET' },
  { name: 'Muhammad Ali Jinnah University', province: 'Sindh', short: 'MAJU' },
  { name: 'Institute of Business Management', province: 'Sindh', short: 'IoBM' },
  { name: 'Dawood University of Engineering and Technology', province: 'Sindh', short: 'DUET' },
  { name: 'Jinnah Sindh Medical University', province: 'Sindh', short: 'JSMU' },
  { name: 'Sindh Madressatul Islam University', province: 'Sindh', short: 'SMIU' },
  { name: 'Jinnah University for Women', province: 'Sindh', short: 'JUW' },
  { name: 'DHA Suffa University', province: 'Sindh', short: 'DSU' },
  { name: 'Baqai Medical University', province: 'Sindh' },
  { name: 'Indus Valley School of Art and Architecture', province: 'Sindh', short: 'IVS' },
  { name: 'Textile Institute of Pakistan', province: 'Sindh', short: 'TIP' },
  { name: 'Karachi Institute of Economics and Technology', province: 'Sindh', short: 'KIET' },
  { name: 'Karachi School for Business and Leadership', province: 'Sindh', short: 'KSBL' },
  { name: 'Karachi Institute of Technology and Entrepreneurship', province: 'Sindh', short: 'KITE' },
  { name: 'Karachi Institute of Power Engineering', province: 'Sindh', short: 'KINPOE' },
  { name: 'Greenwich University, Karachi', province: 'Sindh' },
  { name: 'Indus University, Karachi', province: 'Sindh' },
  { name: 'Ilma University', province: 'Sindh' },
  { name: 'Preston University, Karachi', province: 'Sindh' },
  { name: 'Dadabhoy Institute of Higher Education', province: 'Sindh' },
  { name: 'Nazeer Hussain University', province: 'Sindh' },
  { name: 'Salim Habib University', province: 'Sindh' },
  { name: 'Sohail University', province: 'Sindh' },
  { name: 'Malir University of Science and Technology', province: 'Sindh' },
  { name: 'Emaan Institute of Management and Sciences', province: 'Sindh' },
  { name: 'Millennium Institute of Technology and Entrepreneurship', province: 'Sindh' },
  { name: 'Commecs Institute of Business and Emerging Sciences', province: 'Sindh' },
  { name: 'KASB Institute of Technology', province: 'Sindh' },
  { name: 'Newports Institute of Communications and Economics', province: 'Sindh' },
  { name: 'Sindh Institute of Medical Sciences', province: 'Sindh' },
  { name: 'City University of Health Sciences, Karachi', province: 'Sindh' },
  { name: 'Benazir Bhutto Shaheed University, Karachi', province: 'Sindh' },
  { name: 'Shaheed Benazir Bhutto City University, Karachi', province: 'Sindh' },
  { name: 'Shaheed Benazir Bhutto Dewan University', province: 'Sindh' },
  { name: 'Shaheed Zulfiqar Ali Bhutto University of Law', province: 'Sindh', short: 'SZABUL' },
  { name: 'Qalandar Shahbaz University of Modern Sciences', province: 'Sindh' },
  { name: 'University of Sindh, Jamshoro', province: 'Sindh', short: 'USindh' },
  { name: 'Mehran University of Engineering and Technology', province: 'Sindh', short: 'MUET' },
  { name: 'Liaquat University of Medical and Health Sciences', province: 'Sindh', short: 'LUMHS' },
  { name: 'Sindh Agriculture University, Tandojam', province: 'Sindh', short: 'SAU' },
  { name: 'Government College University, Hyderabad', province: 'Sindh' },
  { name: 'Isra University, Hyderabad', province: 'Sindh' },
  { name: 'University of EAST, Hyderabad', province: 'Sindh' },
  { name: 'Hyderabad Institute for Technical and Management Sciences', province: 'Sindh' },
  { name: 'University of Art and Culture, Jamshoro', province: 'Sindh' },
  { name: 'Shaheed Allah Bux Soomro University of Art, Design and Heritages', province: 'Sindh' },
  { name: 'Shah Abdul Latif University, Khairpur', province: 'Sindh', short: 'SALU' },
  { name: 'Sukkur IBA University', province: 'Sindh', short: 'IBA Sukkur' },
  { name: 'Quaid-e-Awam University of Engineering, Science and Technology', province: 'Sindh', short: 'QUEST' },
  { name: 'Shaheed Benazir Bhutto University, Benazirabad', province: 'Sindh', short: 'SBBU' },
  { name: 'Peoples University of Medical and Health Sciences for Women', province: 'Sindh', short: 'PUMHS' },
  { name: 'Shaheed Benazir Bhutto University of Veterinary and Animal Sciences', province: 'Sindh', short: 'SBBUVAS' },
  { name: 'Shaheed Mohtarma Benazir Bhutto Medical University, Larkana', province: 'Sindh', short: 'SMBBMU' },
  { name: 'University of Larkano', province: 'Sindh' },
  { name: 'Begum Nusrat Bhutto Women University, Sukkur', province: 'Sindh' },
  { name: 'Aror University of Art, Architecture, Design and Heritage', province: 'Sindh' },
  { name: 'The Shaikh Ayaz University, Shikarpur', province: 'Sindh' },
  { name: 'Pir Abdul Qadir Shah Jeelani Institute of Medical Sciences', province: 'Sindh' },
  { name: 'Benazir Bhutto Shaheed University of Technology and Skill Development', province: 'Sindh' },
  { name: 'University of Sufism and Modern Sciences, Bhit Shah', province: 'Sindh' },

  // ── Khyber Pakhtunkhwa ────────────────────────────────────────────────────
  { name: 'University of Peshawar', province: 'Khyber Pakhtunkhwa', short: 'UOP' },
  { name: 'University of Engineering and Technology, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'UET Peshawar' },
  { name: 'Islamia College University, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'ICP' },
  { name: 'Khyber Medical University', province: 'Khyber Pakhtunkhwa', short: 'KMU' },
  { name: 'University of Agriculture, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { name: 'Institute of Management Sciences, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'IMSciences' },
  { name: 'Ghulam Ishaq Khan Institute of Engineering Sciences and Technology', province: 'Khyber Pakhtunkhwa', short: 'GIKI' },
  { name: 'Abdul Wali Khan University, Mardan', province: 'Khyber Pakhtunkhwa', short: 'AWKUM' },
  { name: 'Hazara University, Mansehra', province: 'Khyber Pakhtunkhwa' },
  { name: 'Kohat University of Science and Technology', province: 'Khyber Pakhtunkhwa', short: 'KUST' },
  { name: 'Gomal University, Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Malakand', province: 'Khyber Pakhtunkhwa', short: 'UOM' },
  { name: 'University of Swat', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Haripur', province: 'Khyber Pakhtunkhwa', short: 'UOH' },
  { name: 'University of Swabi', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Buner', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Chitral', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Dir, Timergara', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Shangla', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Lakki Marwat', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Science and Technology, Bannu', province: 'Khyber Pakhtunkhwa', short: 'USTB' },
  { name: 'Bacha Khan University, Charsadda', province: 'Khyber Pakhtunkhwa', short: 'BKUC' },
  { name: 'Khushal Khan Khattak University, Karak', province: 'Khyber Pakhtunkhwa', short: 'KKKUK' },
  { name: 'Abbottabad University of Science and Technology', province: 'Khyber Pakhtunkhwa', short: 'AUST' },
  { name: 'Shaheed Benazir Bhutto University, Sheringal', province: 'Khyber Pakhtunkhwa', short: 'SBBU Sheringal' },
  { name: 'Shaheed Benazir Bhutto Women University, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'SBBWU' },
  { name: 'Women University, Mardan', province: 'Khyber Pakhtunkhwa' },
  { name: 'Women University, Swabi', province: 'Khyber Pakhtunkhwa' },
  { name: 'FATA University', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Engineering and Technology, Mardan', province: 'Khyber Pakhtunkhwa', short: 'UET Mardan' },
  { name: 'University of Agriculture, Dera Ismail Khan', province: 'Khyber Pakhtunkhwa' },
  { name: 'University of Technology, Nowshera', province: 'Khyber Pakhtunkhwa', short: 'UOTN' },
  { name: 'University of Engineering and Applied Sciences, Swat', province: 'Khyber Pakhtunkhwa', short: 'UEAS' },
  { name: 'University of Veterinary and Animal Sciences, Swat', province: 'Khyber Pakhtunkhwa' },
  { name: 'Pak-Austria Fachhochschule: Institute of Applied Sciences and Technology', province: 'Khyber Pakhtunkhwa', short: 'PAF-IAST' },
  { name: 'CECOS University of Information Technology and Emerging Sciences', province: 'Khyber Pakhtunkhwa', short: 'CECOS' },
  { name: 'City University of Science and Information Technology, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'CUSIT' },
  { name: 'Sarhad University of Science and Information Technology', province: 'Khyber Pakhtunkhwa', short: 'SUIT' },
  { name: 'IQRA National University, Peshawar', province: 'Khyber Pakhtunkhwa', short: 'INU' },
  { name: 'Abasyn University, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { name: 'Gandhara University, Peshawar', province: 'Khyber Pakhtunkhwa' },
  { name: 'Qurtuba University of Science and Information Technology', province: 'Khyber Pakhtunkhwa' },
  { name: 'Northern University, Nowshera', province: 'Khyber Pakhtunkhwa' },
  { name: 'Preston University, Kohat', province: 'Khyber Pakhtunkhwa' },

  // ── Balochistan ───────────────────────────────────────────────────────────
  { name: 'University of Balochistan', province: 'Balochistan', short: 'UOB' },
  { name: 'Balochistan University of Information Technology, Engineering and Management Sciences', province: 'Balochistan', short: 'BUITEMS' },
  { name: 'Balochistan University of Engineering and Technology, Khuzdar', province: 'Balochistan', short: 'BUET Khuzdar' },
  { name: 'Bolan University of Medical and Health Sciences', province: 'Balochistan', short: 'BUMHS' },
  { name: 'Sardar Bahadur Khan Women’s University', province: 'Balochistan', short: 'SBKWU' },
  { name: 'Lasbela University of Agriculture, Water and Marine Sciences', province: 'Balochistan', short: 'LUAWMS' },
  { name: 'University of Turbat', province: 'Balochistan', short: 'UOT' },
  { name: 'University of Loralai', province: 'Balochistan' },
  { name: 'University of Gwadar', province: 'Balochistan' },
  { name: 'University of Makran, Panjgur', province: 'Balochistan' },
  { name: 'Mir Chakar Khan Rind University, Sibi', province: 'Balochistan' },
  { name: 'Al-Hamd Islamic University', province: 'Balochistan' },

  // ── Federal / military academies ──────────────────────────────────────────
  { name: 'Pakistan Military Academy, Kakul', province: 'Federal' },
  { name: 'Pakistan Air Force Academy, Risalpur', province: 'Federal' },
  { name: 'Pakistan Naval Academy, Karachi', province: 'Federal' },
];

/** Plain names, in list order (Gilgit-Baltistan first). */
export const PK_UNIVERSITY_NAMES = PK_UNIVERSITIES.map(u => u.name);

/* Combobox options: the stored value is the full name, but typing an
 * abbreviation or a city finds it. `keywords` never reaches the database. */
export const PK_UNIVERSITY_OPTIONS = PK_UNIVERSITIES.map(u => ({
  value: u.name,
  keywords: `${u.short || ''} ${u.province}`,
}));

const BY_SHORT = new Map();
for (const u of PK_UNIVERSITIES) {
  for (const s of String(u.short || '').split(' ').filter(Boolean)) {
    const k = s.toLowerCase();
    if (!BY_SHORT.has(k)) BY_SHORT.set(k, u.name);
  }
}

/**
 * Expand an abbreviation to the full name, or return the input unchanged.
 * "KIU" → "Karakoram International University"; "Oxford" → "Oxford".
 *
 * Used to tidy values that were typed before this list existed. It does NOT
 * reject anything it does not recognise — a foreign university passes straight
 * through, which is the whole point.
 */
export function expandUniversity(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return BY_SHORT.get(v.toLowerCase()) || v;
}
