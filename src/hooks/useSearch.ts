import { useState, useMemo, useCallback } from 'react'
import type { ColumnDef } from '../types'
import { searchRecords } from '../lib/search'
import { useDebounce } from './useDebounce'

interface UseSearchOptions<T extends object> {
  data: T[]
  columns: ColumnDef<T>[]
}

export function useSearch<T extends object>({ data, columns }: UseSearchOptions<T>) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 150)

  const filteredData = useMemo(
    () => searchRecords(data, debouncedQuery, columns),
    [data, debouncedQuery, columns],
  )

  const clearSearch = useCallback(() => setQuery(''), [])

  return {
    query,
    setQuery,
    clearSearch,
    filteredData,
  }
}
