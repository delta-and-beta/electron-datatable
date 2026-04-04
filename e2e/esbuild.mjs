import { build } from 'esbuild'

await build({
  entryPoints: ['src/app.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'iife',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'react',
  loader: { '.json': 'json' },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

console.log('Bundle complete → dist/app.js')
