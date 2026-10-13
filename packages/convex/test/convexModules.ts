// convex-test expects Vite's import.meta.glob; under bun the module map is built by hand.
export const modules = Object.fromEntries(
  [...new Bun.Glob('**/*.{ts,js}').scanSync(`${import.meta.dir}/../src`)].map((path) => [
    `../src/${path}`,
    () => import(`../src/${path}`),
  ]),
)
