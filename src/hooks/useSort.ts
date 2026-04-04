import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RowData } from '../types'
import { sortRecords } from '../lib/sort'

interface UseSortOptions<T extends RowData> {
  data: T[]
  defaultField?: string
  defaultDirection?: 'asc' | 'desc'
  storageKey?: string
}

interface SortState {
  field: string | null
  direction: 'asc' | 'desc'
}

export function useSort<T extends RowData>({
  data,
  defaultField,
  defaultDirection = 'asc',
  storageKey,
}: UseSortOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-sort` : null

  const [state, setState] = useState<SortState>(() => {
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (
            parsed &&
            typeof parsed.field === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            return parsed as SortState
          }
        }
      } catch {
        // ignore
      }
    }
    return { field: defaultField ?? null, direction: defaultDirection }
  })

  // Persist
  useEffect(() => {
    if (!fullKey) return
    try {
      localStorage.setItem(fullKey, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [fullKey, state])

  const sortedData = useMemo(() => {
    if (!state.field) return data
    return sortRecords(data, state.field, state.direction)
  }, [data, state.field, state.direction])

  const setSort = useCallback((field: string, direction?: 'asc' | 'desc') => {
    setState((prev) => {
      if (prev.field === field && !direction) {
        // Toggle direction
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { field, direction: direction ?? 'asc' }
    })
  }, [])

  return {
    sortField: state.field,
    sortDirection: state.direction,
    setSort,
    sortedData,
  }
}
