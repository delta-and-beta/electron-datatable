import { describe, expect, it } from 'vitest'
import {
  applyDataTableTheme,
  getDataTableThemeMode,
  setDataTableThemeMode,
} from './index'

describe('applyDataTableTheme', () => {
  it('sets token variables on a scope and cleans up exactly those variables', () => {
    const scope = document.createElement('section')
    scope.style.setProperty('--consumer-token', 'preserved')
    scope.style.setProperty('--dt-text', '#ffffff')

    const cleanup = applyDataTableTheme(
      {
        primary: '#8b5cf6',
        'badge-warning': '#f59e0b',
      },
      scope,
    )

    expect(scope.style.getPropertyValue('--dt-primary')).toBe('#8b5cf6')
    expect(scope.style.getPropertyValue('--dt-badge-warning')).toBe('#f59e0b')

    cleanup()

    expect(scope.style.getPropertyValue('--dt-primary')).toBe('')
    expect(scope.style.getPropertyValue('--dt-badge-warning')).toBe('')
    expect(scope.style.getPropertyValue('--consumer-token')).toBe('preserved')
    expect(scope.style.getPropertyValue('--dt-text')).toBe('#ffffff')
  })
})

describe('data table theme mode', () => {
  it('round-trips the scoped data-dt-theme attribute', () => {
    const scope = document.createElement('section')

    expect(getDataTableThemeMode(scope)).toBeNull()

    setDataTableThemeMode('light', scope)

    expect(scope.getAttribute('data-dt-theme')).toBe('light')
    expect(getDataTableThemeMode(scope)).toBe('light')

    setDataTableThemeMode('dark', scope)

    expect(getDataTableThemeMode(scope)).toBe('dark')
  })
})
