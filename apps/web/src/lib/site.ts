/**
 * The public address, set per deployment (`VITE_SITE_URL`). Canonical links,
 * og:url and the JSON-LD need it; without it they are simply left out.
 */
export const SITE_URL: string | null = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || null

/**
 * The head of a public page: its own title and description, indexable (the
 * root marks every other route noindex), and canonical when the site is known.
 */
export function publicHead(page: { title: string; description: string; path: string }) {
  return {
    meta: [
      { title: page.title },
      { name: 'description', content: page.description },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.description },
      ...(SITE_URL != null ? [{ property: 'og:url', content: `${SITE_URL}${page.path}` }] : []),
    ],
    links: SITE_URL != null ? [{ rel: 'canonical', href: `${SITE_URL}${page.path}` }] : [],
  }
}
