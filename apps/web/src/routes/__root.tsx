import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { TooltipProvider } from "@/components/ui/tooltip"
import { authClient } from '../lib/auth-client'

import appCss from '../styles.css?url'

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
        content: 'width=device-width, initial-scale=1, interactive-widget=resizes-content',
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
      { name: 'theme-color', content: '#16233f' },
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
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  component: RootComponent,
})

// The design direction, emitted as the first thing in <body> so the built page
// carries it (see DESIGN.md).
const DIRECTION_CONTRACT = `<!--
THESIS: a 5 mm squared notebook as an instrument: a ruling everything respects and a red margin where the teacher's judgment lives; refuses the blue LMS of cards and the KPI dashboard.
OWN-WORLD: cold white paper, pale blue ruling only on work sheets, navy ink, margin red for mistakes and risk, green ink for right, pencil grey for tentative; Source Serif 4 headings, Public Sans work; 1px rules, square controls, no cards, no shadows.
STORY: the student knows what to study today and their ICFES level per area; the teacher knows who and which competency is at risk; the school sees it as its own.
FIRST VIEWPORT (Hoy): cover label with the school crest top left; today's plan as numbered lines on the ruling, "Empezar" on the first line; date and study days in the margin column.
FORM: Cuaderno cuadriculado, seed 6ffabd95.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`

function RootComponent() {
  const ctx = useRouteContext({ from: Route.id })
  return (
    <ConvexBetterAuthProvider
      client={ctx.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={ctx.token ?? undefined}
    >
      <html lang="es-CO" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <HeadContent />
        </head>
        <body className="font-sans antialiased">
          <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
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
          <Scripts />
        </body>
      </html>
    </ConvexBetterAuthProvider>
  )
}
