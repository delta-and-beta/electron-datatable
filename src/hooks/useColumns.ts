import { useState, useCallback, useEffect } from 'react'
import type { RowData, ColumnDef } from '../types'

interface UseColumnsOptions<T extends RowData> {
  columns: ColumnDef<T>[]
  storageKey?: string
}

interface ColumnState {
  visible: string[]
  order: string[]
}

export function useColumns<T extends RowData>({ columns, storageKey }: UseColumnsOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-columns` : null

  const [state, setState] = useState<ColumnState>(() => {
    // Try loading from localStorage
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const parsed: ColumnState = JSON.parse(saved)
          // Validate against current columns
          const validIds = new Set(columns.map((c) => c.id))
          return {
            visible: parsed.visible.filter((id) => validIds.has(id)),
            order: parsed.order.filter((id) => validIds.has(id)),
          }
        }
      } catch {
        // ignore
      }
    }

    // Defaults from column defs
    return {
      visible: columns.filter((c) => c.visible !== false).map((c) => c.id),
      order: columns.map((c) => c.id),
    }
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

  const visibleColumns = state.order.filter((id) => state.visible.includes(id))

  const setColumnVisibility = useCallback((id: string, visible: boolean) => {
    setState((prev) => ({
      ...prev,
      visible: visible ? [...prev.visible, id] : prev.visible.filter((v) => v !== id),
    }))
  }, [])

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const next = [...prev.order]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return { ...prev, order: next }
    })
  }, [])

  const isVisible = useCallback((id: string) => state.visible.includes(id), [state.visible])

  return {
    visibleColumns,
    allColumns: state.order,
    setColumnVisibility,
    reorderColumns,
    isVisible,
  }
}
