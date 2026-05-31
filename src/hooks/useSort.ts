import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RowData } from '../types'
import { sortRecordsMulti, type SortLevel } from '../lib/sort'

interface UseSortOptions<T extends RowData> {
  data: T[]
  defaultField?: string
  defaultDirection?: 'asc' | 'desc'
  storageKey?: string
}

function isLevel(x: unknown): x is SortLevel {
  const l = x as SortLevel
  return !!l && typeof l.field === 'string' && (l.direction === 'asc' || l.direction === 'desc')
}

/** Parse persisted sort — supports the multi-level array and the legacy single-object format. */
function parseStored(raw: string): SortLevel[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.every(isLevel) ? (parsed as SortLevel[]) : null
    if (isLevel(parsed)) return [parsed] // migrate legacy { field, direction }
    return null
  } catch {
    return null
  }
}

export function useSort<T extends RowData>({
  data,
  defaultField,
  defaultDirection = 'asc',
  storageKey,
}: UseSortOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-sort` : null

  const [levels, setLevels] = useState<SortLevel[]>(() => {
    if (fullKey) {
      const saved = localStorage.getItem(fullKey)
      const parsed = saved ? parseStored(saved) : null
      if (parsed) return parsed
    }
    return defaultField ? [{ field: defaultField, direction: defaultDirection }] : []
  })

  // Persist
  useEffect(() => {
    if (!fullKey) return
    try {
      localStorage.setItem(fullKey, JSON.stringify(levels))
    } catch {
      // ignore
    }
  }, [fullKey, levels])

  const sortedData = useMemo(() => sortRecordsMulti(data, levels), [data, levels])

  /** Single-field sort (header click): sort solely by `field`, toggling direction on repeat. */
  const setSort = useCallback((field: string, direction?: 'asc' | 'desc') => {
    setLevels((prev) => {
      const primary = prev[0]
      if (primary && primary.field === field && prev.length === 1 && !direction) {
        return [{ field, direction: primary.direction === 'asc' ? 'desc' : 'asc' }]
      }
      return [{ field, direction: direction ?? 'asc' }]
    })
  }, [])

  return {
    // Backward-compatible single-field view (the primary level)
    sortField: levels[0]?.field ?? null,
    sortDirection: levels[0]?.direction ?? defaultDirection,
    setSort,
    // Multi-field API (used by the Sort toolbar panel)
    sortLevels: levels,
    setSortLevels: setLevels,
    sortedData,
  }
}
