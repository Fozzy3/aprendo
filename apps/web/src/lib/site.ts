/**
 * The public address, set per deployment (`VITE_SITE_URL`). Canonical links,
 * og:url, the sharing image and the JSON-LD need it; without it they are simply
 * left out.
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
      ...(SITE_URL != null
        ? [
            { property: 'og:url', content: `${SITE_URL}${page.path}` },
            { property: 'og:image', content: `${SITE_URL}/og.png` },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
            { property: 'og:image:alt', content: 'Aprendo: Saber 11, sepa qué enseñar cada semana' },
            { name: 'twitter:card', content: 'summary_large_image' },
          ]
        : []),
    ],
    links: SITE_URL != null ? [{ rel: 'canonical', href: `${SITE_URL}${page.path}` }] : [],
  }
}
