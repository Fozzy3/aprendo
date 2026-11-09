import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { ConfirmDialogHost } from '../components/ConfirmDialog'
import { Toaster } from '../components/Toast'
import { authClient } from '../lib/auth-client'
import { lookForPath } from '../lib/student-look'

import appCss from '../styles.css?url'
import studentCss from '../student.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  const { getToken } = await import('../lib/auth-server')
  const token = await getToken()
  return token ?? null
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
  /** Set by `beforeLoad` during SSR and carried through hydration. */
  token?: string | null
}>()({
  beforeLoad: async (ctx) => {
    // Server-side only.
    //
    // This exists so the very first render already has a token: during SSR it
    // reads the auth cookie and hands it to Convex's HTTP client. After
    // hydration `ConvexBetterAuthProvider` and `authClient` own the token, and
    // there is nothing here worth repeating.
    //
    // It used to run on every pass of the router, on the client too. Because it
    // both mutated the Convex client and returned a fresh `{ token }` into route
    // context, each run could provoke the next: the app fired the same
    // `_serverFn` request dozens of times over a few seconds, never settled, and
    // any page you navigated to stayed blank — which read as "the nav is
    // broken" rather than as a request loop.
    if (typeof document !== 'undefined') {
      return { token: ctx.context.token ?? null }
    }

    const token = await fetchAuthToken()
    if (token) {
      const httpClient = (ctx.context.convexQueryClient as unknown as {
        serverHttpClient?: { setAuth: (token: string) => void }
      }).serverHttpClient
      httpClient?.setAuth(token)
    }
    return { token }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        // The keyboard resizes the page, so the fixed tutor sheet stays above it.
        content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
      },
      {
        title: 'Aprendo | ICFES Saber 11',
      },
      {
        name: 'description',
        content:
          'Aprendo ubica a cada estudiante de grado 11 en los niveles del Saber 11, le arma un plan diario y le muestra al docente quién necesita apoyo.',
      },
      // Private by default: the app's routes guard on the client, so the server
      // answers them with a loader. Public pages opt back in (lib/site.ts).
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Aprendo' },
      { property: 'og:locale', content: 'es_CO' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'stylesheet', href: studentCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const ctx = useRouteContext({ from: Route.id })
  const look = useRouterState({ select: (state) => lookForPath(state.location.pathname) })
  return (
    <ConvexBetterAuthProvider
      client={ctx.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={ctx.token ?? undefined}
    >
      <html lang="es-CO" data-look={look} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <HeadContent />
          {/* Matches the top bar: Álbum green for students, the navy cover for the rest. */}
          <meta name="theme-color" content={look === 'student' ? '#097d52' : '#16233f'} />
        </head>
        <body className="font-sans antialiased">
          <Outlet />
          <Toaster />
          <ConfirmDialogHost />
          {import.meta.env.DEV ? (
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          ) : null}
          <Scripts />
        </body>
      </html>
    </ConvexBetterAuthProvider>
  )
}
