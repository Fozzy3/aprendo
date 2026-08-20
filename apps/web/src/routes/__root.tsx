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
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Aprendo | ICFES Saber 11',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const ctx = useRouteContext({ from: Route.id })
  return (
    <ConvexBetterAuthProvider
      client={ctx.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={ctx.token ?? undefined}
    >
      <html lang="es" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <HeadContent />
        </head>
        <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[var(--accent-soft)]">
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
