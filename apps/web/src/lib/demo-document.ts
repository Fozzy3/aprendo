import type { ResolvedTheme } from './use-resolved-theme.ts'

/**
 * Design tokens injected into the lesson-demo iframe so the generated demo looks
 * like part of Aprendo instead of a generic web page. These mirror the subset of
 * `styles.css` that demos are told to use (see `DEMO_FRAGMENT_RULES` in
 * `packages/convex/src/lessons.ts`) — keep the two in sync.
 */
const TOKENS: Record<ResolvedTheme, Record<string, string>> = {
  light: {
    '--bg': '#ffffff',
    '--bg-card': '#ffffff',
    '--bg-inset': '#f5f2ff',
    '--text-primary': '#1b1235',
    '--text-secondary': '#5b5473',
    '--text-tertiary': '#8e88a3',
    '--text-inverted': '#ffffff',
    '--brand': '#6c4cf1',
    '--accent': '#6c4cf1',
    '--accent-soft': 'rgba(108, 76, 241, 0.1)',
    '--accent-hover': '#5a3ad9',
    '--gold': '#ffc93c',
    '--success': '#21c08b',
    '--danger': '#ff5d5d',
    '--border': 'rgba(27, 18, 53, 0.1)',
    '--border-hard': '#1b1235',
  },
  dark: {
    '--bg': '#0e1020',
    '--bg-card': '#171a2e',
    '--bg-inset': '#121427',
    '--text-primary': '#f2f0ff',
    '--text-secondary': '#a49fc4',
    '--text-tertiary': '#736e91',
    '--text-inverted': '#0e1020',
    '--brand': '#9b83ff',
    '--accent': '#9b83ff',
    '--accent-soft': 'rgba(155, 131, 255, 0.16)',
    '--accent-hover': '#b09aff',
    '--gold': '#ffd469',
    '--success': '#3fd8a4',
    '--danger': '#ff7d7d',
    '--border': 'rgba(255, 255, 255, 0.1)',
    '--border-hard': '#05060f',
  },
}

const RADII = {
  '--radius-sm': '14px',
  '--radius-md': '20px',
}

const FONTS = {
  '--font-sans': '"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif',
  '--font-display': '"Bricolage Grotesque", "Hanken Grotesk", sans-serif',
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
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
  h1, h2, h3, h4 { font-family: var(--font-display); font-weight: 700; margin: 0 0 0.5rem; }
  p { color: var(--text-secondary); }
  button {
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
    color: var(--text-inverted);
    background: var(--brand);
    border: 2px solid var(--border-hard);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.9rem;
    box-shadow: 0 3px 0 var(--border-hard);
    transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.12s ease;
  }
  button:hover { background: var(--accent-hover); }
  button:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border-hard); }
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
