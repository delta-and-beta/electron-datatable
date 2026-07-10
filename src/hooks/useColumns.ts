import { useState, useCallback, useEffect } from 'react'
import type { ColumnDef } from '../types'

interface UseColumnsOptions<T extends object> {
  columns: ColumnDef<T>[]
  storageKey?: string
}

interface ColumnState {
  visible: string[]
  order: string[]
  widths: Record<string, number>
}

export function useColumns<T extends object>({ columns, storageKey }: UseColumnsOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-columns` : null

  const [state, setState] = useState<ColumnState>(() => {
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (
            parsed &&
            Array.isArray(parsed.visible) &&
            Array.isArray(parsed.order)
          ) {
            const validIds = new Set(columns.map((c) => c.id))
            return {
              visible: parsed.visible.filter((id: unknown) => typeof id === 'string' && validIds.has(id)),
              order: parsed.order.filter((id: unknown) => typeof id === 'string' && validIds.has(id)),
              widths: parsed.widths && typeof parsed.widths === 'object' ? parsed.widths : {},
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      visible: columns.filter((c) => c.visible !== false).map((c) => c.id),
      order: columns.map((c) => c.id),
      widths: {},
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

  const setColumnWidth = useCallback((id: string, width: number) => {
    setState((prev) => ({ ...prev, widths: { ...prev.widths, [id]: width } }))
  }, [])

  return {
    visibleColumns,
    allColumns: state.order,
    widths: state.widths,
    setColumnVisibility,
    reorderColumns,
    setColumnWidth,
    isVisible,
  }
}
