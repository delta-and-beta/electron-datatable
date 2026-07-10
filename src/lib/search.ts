import type { ColumnDef } from '../types'
import { asRecord } from './as-record'

/** Filter records by a search query across searchable columns */
export function searchRecords<T extends object>(
  records: T[],
  query: string,
  columns: ColumnDef<T>[],
): T[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return records

  // Columns that explicitly opt in, OR are text/custom and don't opt out
  const fields = columns
    .filter((col) => {
      if (col.searchable === true) return true
      if (col.searchable === false) return false
      return col.type === 'text' || col.type === 'custom'
    })
    .map((col) => col.id)

  // No searchable columns → search is disabled, return all records
  if (fields.length === 0) return records

  return records.filter((record) =>
    fields.some((field) => {
      const value = asRecord(record)[field]
      if (value == null) return false
      return String(value).toLowerCase().includes(trimmed)
    }),
  )
}
