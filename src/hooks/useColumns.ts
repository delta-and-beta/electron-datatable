import { useState, useCallback, useEffect, useRef } from 'react'
import type { ColumnDef } from '../types'

interface UseColumnsOptions<T extends object> {
  columns: ColumnDef<T>[]
  storageKey?: string
  frozenColumns?: number
}

export interface ColumnSnapshot {
  visible: string[]
  order: string[]
  widths: Record<string, number>
  frozen: number
}

function normalizeFrozen(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : Math.max(0, Math.floor(fallback))
}

export function useColumns<T extends object>({
  columns,
  storageKey,
  frozenColumns = 0,
}: UseColumnsOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-columns` : null

  const [state, setState] = useState<ColumnSnapshot>(() => {
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
              frozen: normalizeFrozen(parsed.frozen, frozenColumns),
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
      frozen: normalizeFrozen(frozenColumns),
    }
  })
  const stateRef = useRef(state)
  const columnsRef = useRef(columns)
  const fullKeyRef = useRef(fullKey)
  stateRef.current = state
  columnsRef.current = columns
  fullKeyRef.current = fullKey

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

  const setFrozenColumns = useCallback((count: number) => {
    setState((prev) => ({ ...prev, frozen: normalizeFrozen(count) }))
  }, [])

  const getSnapshot = useCallback((): ColumnSnapshot => ({
    visible: [...stateRef.current.visible],
    order: [...stateRef.current.order],
    widths: { ...stateRef.current.widths },
    frozen: stateRef.current.frozen,
  }), [])

  const restore = useCallback((snapshot: ColumnSnapshot) => {
    const validIds = new Set(columnsRef.current.map((column) => column.id))
    const next: ColumnSnapshot = {
      visible: snapshot.visible.filter((id) => validIds.has(id)),
      order: snapshot.order.filter((id) => validIds.has(id)),
      widths: { ...snapshot.widths },
      frozen: normalizeFrozen(snapshot.frozen),
    }
    if (fullKeyRef.current) {
      try {
        localStorage.setItem(fullKeyRef.current, JSON.stringify(next))
      } catch {
        // ignore quota errors
      }
    }
    stateRef.current = next
    setState(next)
  }, [])

  return {
    visibleColumns,
    allColumns: state.order,
    widths: state.widths,
    frozenColumns: state.frozen,
    setColumnVisibility,
    reorderColumns,
    setColumnWidth,
    setFrozenColumns,
    isVisible,
    getSnapshot,
    restore,
  }
}
