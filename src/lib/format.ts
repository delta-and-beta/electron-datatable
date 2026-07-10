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
  const decimalPlaces = options.decimalPlaces ?? 2
  const displayValue = options.minorUnits
    ? value / 10 ** decimalPlaces
    : value
  const fractionDigits = {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }

  if (options.symbol !== undefined) {
    return `${options.symbol}${new Intl.NumberFormat(undefined, fractionDigits).format(displayValue)}`
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
