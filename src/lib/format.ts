/** Format a number as currency */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  options: {
    minorUnits?: boolean
    decimalPlaces?: number
    symbol?: string
  } = {},
): string {
  const requestedDecimalPlaces = options.decimalPlaces ?? 2
  const decimalPlaces = Number.isFinite(requestedDecimalPlaces)
    ? Math.min(20, Math.max(0, Math.trunc(requestedDecimalPlaces)))
    : 2
  const displayValue = options.minorUnits
    ? value / 10 ** decimalPlaces
    : value
  const fractionDigits = {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }

  if (options.symbol !== undefined) {
    const sign = displayValue < 0 ? '-' : ''
    const formattedValue = new Intl.NumberFormat(undefined, fractionDigits).format(Math.abs(displayValue))
    return `${sign}${options.symbol}${formattedValue}`
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    ...fractionDigits,
  }).format(displayValue)
}

/** Format a date string for display */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Format a number for display */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}
