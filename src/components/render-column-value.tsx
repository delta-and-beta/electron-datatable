import type { ReactNode } from 'react'
import type { ColumnDef } from '../types'
import { formatCurrency, formatDate, formatNumber } from '../lib/format'
import { StatusBadge } from './StatusBadge'

/** Render a value through the same default pipeline used by table cells and cards. */
export function renderColumnValue<T extends object>(
  column: ColumnDef<T>,
  value: unknown,
  row?: T,
  useBadgeVariants = false,
): ReactNode {
  if (column.render) {
    return column.render(value, row ?? ({} as T))
  }

  if (useBadgeVariants && column.badgeVariants) {
    if (value == null || value === '') return '-'

    return (
      <StatusBadge variant={column.badgeVariants[String(value)] ?? 'neutral'}>
        {String(value)}
      </StatusBadge>
    )
  }

  if (column.format) return column.format(value)
  if (value == null) return '-'

  switch (column.type) {
    case 'date':
      return formatDate(value as string | Date)
    case 'number':
      return formatNumber(value as number)
    case 'currency':
      return formatCurrency(value as number, column.currency, {
        minorUnits: column.minorUnits,
        decimalPlaces: column.decimalPlaces,
        symbol: column.symbol,
      })
    case 'tags': {
      const tags = Array.isArray(value)
        ? value.filter((tag): tag is string => typeof tag === 'string')
        : []
      if (tags.length === 0) return '-'
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, index) => (
            <StatusBadge key={`${tag}-${index}`} variant="neutral">
              {tag}
            </StatusBadge>
          ))}
        </div>
      )
    }
    case 'text':
    default:
      return String(value)
  }
}
