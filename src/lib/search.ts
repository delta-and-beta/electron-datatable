import type { RowData, ColumnDef } from '../types'

/** Filter records by a search query across searchable columns */
export function searchRecords<T extends RowData>(
  records: T[],
  query: string,
  columns: ColumnDef<T>[],
): T[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return records

  const searchableFields = columns
    .filter((col) => col.searchable !== false && (col.type === 'text' || col.type === 'custom'))
    .map((col) => col.id)

  // Also include all columns that don't explicitly opt out
  const allSearchableFields = columns
    .filter((col) => col.searchable !== false)
    .map((col) => col.id)

  const fields = searchableFields.length > 0 ? allSearchableFields : columns.map((c) => c.id)

  return records.filter((record) =>
    fields.some((field) => {
      const value = record[field]
      if (value == null) return false
      return String(value).toLowerCase().includes(trimmed)
    }),
  )
}
