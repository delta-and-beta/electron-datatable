import type { Config } from 'tailwindcss'
import { dataTablePreset } from './src/tailwind'

export default {
  content: ['./src/**/*.tsx'],
  presets: [dataTablePreset as Config],
} satisfies Config
