/* Search results are not a document for Google to index — every URL is a
 * different query, and a crawler following them would mint endless thin pages
 * built from member names. The site's real pages stay indexable as before;
 * this affects /search only. */
export const metadata = {
  title: 'Search — Tehreek-e-Nojawanan Roundu',
  description: 'Search TNR members, leadership, scholarships, news, villages, Union Councils and statistics.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }) {
  return children;
}
