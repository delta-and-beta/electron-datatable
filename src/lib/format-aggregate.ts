import type { ColumnDef } from '../types'
import { formatCurrency, formatNumber } from './format'

/** Format an aggregated value using the column's own formatting pipeline */
export function formatAggregateValue<T extends object>(col: ColumnDef<T>, value: number): string {
  if (col.format) return col.format(value)

  switch (col.type) {
    case 'currency':
      return formatCurrency(value, col.currency, {
        minorUnits: col.minorUnits,
        decimalPlaces: col.decimalPlaces,
        symbol: col.symbol,
      })
    case 'number':
      return formatNumber(value)
    default:
      return ''
  }
}
