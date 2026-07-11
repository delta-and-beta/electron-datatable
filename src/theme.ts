export type DtThemeToken =
  | 'primary'
  | 'primary-hover'
  | 'bg'
  | 'bg-secondary'
  | 'border'
  | 'text'
  | 'muted'
  | 'positive'
  | 'negative'
  | 'badge-success'
  | 'badge-warning'
  | 'badge-error'
  | 'badge-info'
  | 'badge-neutral'
  | 'badge-purple'
  | 'badge-cyan'

export type DataTableThemeTokens = Partial<Record<DtThemeToken, string>>
export type DataTableThemeMode = 'dark' | 'light'

export function applyDataTableTheme(
  tokens: DataTableThemeTokens,
  scope: HTMLElement = document.documentElement,
) {
  const properties: string[] = []

  for (const [token, value] of Object.entries(tokens)) {
    if (value === undefined) continue

    const property = `--dt-${token}`
    scope.style.setProperty(property, value)
    properties.push(property)
  }

  return () => {
    for (const property of properties) {
      scope.style.removeProperty(property)
    }
  }
}

export function setDataTableThemeMode(
  mode: DataTableThemeMode,
  scope: HTMLElement = document.documentElement,
) {
  scope.setAttribute('data-dt-theme', mode)
}

export function getDataTableThemeMode(
  scope: HTMLElement = document.documentElement,
): DataTableThemeMode | null {
  const mode = scope.getAttribute('data-dt-theme')
  return mode === 'dark' || mode === 'light' ? mode : null
}
