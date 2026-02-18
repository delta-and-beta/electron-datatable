import { useState, useMemo, useCallback } from 'react'
import type { RowData, ColumnDef } from '../types'
import { searchRecords } from '../lib/search'

interface UseSearchOptions<T extends RowData> {
  data: T[]
  columns: ColumnDef<T>[]
}

export function useSearch<T extends RowData>({ data, columns }: UseSearchOptions<T>) {
  const [query, setQuery] = useState('')

  const filteredData = useMemo(() => searchRecords(data, query, columns), [data, query, columns])

  const clearSearch = useCallback(() => setQuery(''), [])

  return {
    query,
    setQuery,
    clearSearch,
    filteredData,
  }
}
