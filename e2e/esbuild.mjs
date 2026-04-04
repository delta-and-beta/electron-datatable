import { build } from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localModules = resolve(__dirname, 'node_modules')
const libDist = resolve(__dirname, '..', 'dist')

// Force all react/react-dom imports to resolve to THIS directory's node_modules,
// preventing the dual-React-instance problem when the data-table library's
// dist/index.js resolves react from the parent project's node_modules.
const singleReactPlugin = {
  name: 'single-react',
  setup(b) {
    // Intercept bare 'react' and 'react-dom' imports from anywhere
    // and re-resolve them from the e2e node_modules directory.
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
      if (args.resolveDir.includes(localModules)) return undefined // already local
      return b.resolve(args.path, { resolveDir: localModules, kind: args.kind })
    })
  },
}

await build({
  entryPoints: ['src/app.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'iife',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'react',
  loader: { '.json': 'json' },
  plugins: [singleReactPlugin],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

// Copy library CSS into e2e/dist/ so paths work in both dev and packaged builds
mkdirSync(resolve(__dirname, 'dist/themes'), { recursive: true })
copyFileSync(resolve(libDist, 'styles.css'), resolve(__dirname, 'dist/styles.css'))
copyFileSync(resolve(libDist, 'themes/light.css'), resolve(__dirname, 'dist/themes/light.css'))
copyFileSync(resolve(libDist, 'themes/dark.css'), resolve(__dirname, 'dist/themes/dark.css'))

console.log('Bundle complete → dist/app.js + CSS copied')
