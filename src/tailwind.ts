import type { Config } from 'tailwindcss'

export const dataTablePreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        dt: {
          primary: 'var(--dt-primary, #3b82f6)',
          'primary-hover': 'var(--dt-primary-hover, #2563eb)',
          bg: 'var(--dt-bg, #1a1a2e)',
          'bg-secondary': 'var(--dt-bg-secondary, #16213e)',
          border: 'var(--dt-border, #374151)',
          text: 'var(--dt-text, #f3f4f6)',
          muted: 'var(--dt-muted, #9ca3af)',
          positive: 'var(--dt-positive, #22c55e)',
          negative: 'var(--dt-negative, #ef4444)',
          badge: {
            success: 'var(--dt-badge-success, #22c55e)',
            warning: 'var(--dt-badge-warning, #f59e0b)',
            error: 'var(--dt-badge-error, #ef4444)',
            info: 'var(--dt-badge-info, #3b82f6)',
            neutral: 'var(--dt-badge-neutral, #9ca3af)',
            purple: 'var(--dt-badge-purple, #a855f7)',
            cyan: 'var(--dt-badge-cyan, #06b6d4)',
          },
        },
      },
    },
  },
}
