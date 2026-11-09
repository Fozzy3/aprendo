import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  // Streamdown carries its own copy of React otherwise: hooks then break in tests that render it for real.
  test: { server: { deps: { inline: [/streamdown/] } } },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    // vitest never exits while nitro's dev server is up.
    ...(process.env.VITEST ? [] : [nitro()]),
  ],
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
})

export default config
