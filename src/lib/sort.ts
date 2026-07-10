import { asRecord } from './as-record'

/** Compare two values for sorting. Arrays sort by length, then first label. */
export function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  // Nulls always sort last
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  let cmp: number

  if (Array.isArray(a) && Array.isArray(b)) {
    cmp = a.length - b.length
    if (cmp === 0) {
      cmp = String(a[0] ?? '').localeCompare(String(b[0] ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    }
  } else if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b
  } else if (typeof a === 'string' && typeof b === 'string') {
    cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true })
  }

  return direction === 'asc' ? cmp : -cmp
}

/** Sort an array of records by a field */
export function sortRecords<T extends object>(
  records: T[],
  field: string,
  direction: 'asc' | 'desc',
): T[] {
  return [...records].sort((a, b) => compareValues(asRecord(a)[field], asRecord(b)[field], direction))
}

/** A single sort instruction: field + direction. */
export interface SortLevel {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * Sort by multiple fields in priority order — the first level breaks ties,
 * then the second, and so on. Stable and side-effect free.
 */
export function sortRecordsMulti<T extends object>(records: T[], levels: SortLevel[]): T[] {
  if (levels.length === 0) return records
  return [...records].sort((a, b) => {
    for (const lvl of levels) {
      const cmp = compareValues(asRecord(a)[lvl.field], asRecord(b)[lvl.field], lvl.direction)
      if (cmp !== 0) return cmp
    }
    return 0
  })
}
