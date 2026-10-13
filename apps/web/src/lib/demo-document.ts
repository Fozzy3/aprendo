import type { ResolvedTheme } from './use-resolved-theme.ts'

/**
 * Design tokens injected into the lesson-demo iframe so the generated demo looks
 * like part of Aprendo instead of a generic web page. These mirror the subset of
 * `styles.css` that demos are told to use (see `DEMO_FRAGMENT_RULES` in
 * `packages/convex/src/lessons.ts`) — keep the two in sync.
 */
const TOKENS: Record<ResolvedTheme, Record<string, string>> = {
  light: {
    '--bg': '#fbfcfe',
    '--bg-card': '#ffffff',
    '--bg-inset': '#eef3f9',
    '--text-primary': '#16233f',
    '--text-secondary': '#3f4b63',
    '--text-tertiary': '#5a667d',
    '--text-inverted': '#ffffff',
    '--brand': '#16233f',
    '--accent': '#1d4f91',
    '--accent-soft': 'rgba(29, 79, 145, 0.08)',
    '--accent-hover': '#163f75',
    '--warn': '#4a5263',
    '--success': '#2e6b45',
    '--danger': '#c3352b',
    '--border': 'rgba(22, 35, 63, 0.13)',
    '--rule': '#c9d8ea',
  },
  dark: {
    '--bg': '#0f1626',
    '--bg-card': '#131c2f',
    '--bg-inset': '#0b111e',
    '--text-primary': '#e4eaf4',
    '--text-secondary': '#b4bdcd',
    '--text-tertiary': '#929cb0',
    '--text-inverted': '#0f1626',
    '--brand': '#e4eaf4',
    '--accent': '#8db6ee',
    '--accent-soft': 'rgba(141, 182, 238, 0.12)',
    '--accent-hover': '#a9c8f3',
    '--warn': '#aab3c4',
    '--success': '#6cbf8b',
    '--danger': '#e8695e',
    '--border': 'rgba(228, 234, 244, 0.12)',
    '--rule': '#24324b',
  },
}

const RADII = {
  '--radius-sm': '2px',
  '--radius-md': '3px',
}

const FONTS = {
  '--font-sans': '"Public Sans", ui-sans-serif, system-ui, sans-serif',
  '--font-display': '"Source Serif 4", Georgia, serif',
}

function rootBlock(theme: ResolvedTheme): string {
  const vars = { ...TOKENS[theme], ...RADII, ...FONTS }
  return Object.entries(vars)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join('\n')
}

/**
 * Wrap an AI-generated demo *fragment* in a full, sandboxed HTML document that
 * carries the app's fonts, color tokens and current theme. The generated
 * fragment references those CSS variables, so the demo inherits Aprendo's look
 * and matches light/dark mode.
 */
export function buildDemoDocument(fragment: string, theme: ResolvedTheme): string {
  return `<!DOCTYPE html>
<html lang="es" data-theme="${theme}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet" />
<style>
  :root {
${rootBlock(theme)}
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    padding: 1.25rem;
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--bg-card);
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4 { font-family: var(--font-display); font-weight: 600; margin: 0 0 0.5rem; }
  p { color: var(--text-secondary); }
  button {
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    color: var(--text-inverted);
    background: var(--brand);
    border: 1px solid var(--brand);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.9rem;
    transition: background 0.15s ease;
  }
  button:hover { opacity: 0.9; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  input[type="range"] { accent-color: var(--accent); width: 100%; }
  label { color: var(--text-secondary); font-size: 13px; font-weight: 600; }
</style>
</head>
<body>
${fragment}
</body>
</html>`
}
