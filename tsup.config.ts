import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'tailwindcss'],
    treeshake: true,
  },
  {
    entry: ['src/tailwind.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    external: ['tailwindcss'],
  },
])
