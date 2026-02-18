import type { RowData } from '../types'

/** Compare two values for sorting */
export function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  // Nulls always sort last
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  let cmp: number

  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b
  } else if (typeof a === 'string' && typeof b === 'string') {
    cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true })
  }

  return direction === 'asc' ? cmp : -cmp
}

/** Sort an array of records by a field */
export function sortRecords<T extends RowData>(
  records: T[],
  field: string,
  direction: 'asc' | 'desc',
): T[] {
  return [...records].sort((a, b) => compareValues(a[field], b[field], direction))
}
