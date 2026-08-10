/* Served at /robots.txt.
 *
 * Two jobs: point crawlers at the sitemap, and keep them out of the areas
 * that are private or personal.
 *
 * Worth being clear about what a disallow does and does not do. It asks
 * well-behaved crawlers not to FETCH a path; it is not access control, and it
 * does not remove a page already indexed. The real protection on /admin and
 * /member is the authentication in front of them — this only stops those URLs
 * turning up in search results, which is a tidiness matter rather than a
 * security one.
 */
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',              // authenticated panel
          '/super-admin',        // committee vote entry
          '/member/',            // the whole member portal — personal to each member
          '/api/',               // JSON endpoints; nothing here belongs in an index
          '/membership/status',  // a specific applicant's own progress
          '/vote',               // a live ballot is not a document to index
        ],
      },
    ],
    sitemap: 'https://www.mytnr.org/sitemap.xml',
    host: 'https://www.mytnr.org',
  };
}
