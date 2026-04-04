import { defineConfig } from 'electron-dev-bridge'

export default defineConfig({
  app: {
    name: 'data-table-e2e',
    path: __dirname,
  },
  cdpTools: true,
  screenshots: { dir: '.screenshots', format: 'png' },
})
