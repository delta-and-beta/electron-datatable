import { defineConfig } from 'electron-dev-bridge'

export default defineConfig({
  app: {
    name: 'electron-datatable',
    path: __dirname,
  },
  cdpTools: true,
  screenshots: { dir: '.screenshots', format: 'png' },
})
