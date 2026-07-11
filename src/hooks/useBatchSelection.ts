import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { asRecord } from '../lib/as-record'

export function useBatchSelection<T extends object>({
  enabled,
  rows,
  rowKey,
}: {
  enabled: boolean
  rows: T[]
  rowKey: string
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const anchorIdRef = useRef<string | null>(null)

  const getId = useCallback((row: T) => String(asRecord(row)[rowKey]), [rowKey])

  const clear = useCallback(() => {
    anchorIdRef.current = null
    setSelectedIds((current) => current.size === 0 ? current : new Set())
  }, [])

  useEffect(() => {
    if (!enabled) clear()
  }, [clear, enabled])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(getId(row))),
    [getId, rows, selectedIds],
  )

  const toggleRow = useCallback((row: T, shiftKey: boolean) => {
    const id = getId(row)
    setSelectedIds((current) => {
      const next = new Set(current)
      const anchorIndex = anchorIdRef.current === null
        ? -1
        : rows.findIndex((candidate) => getId(candidate) === anchorIdRef.current)
      const rowIndex = rows.findIndex((candidate) => getId(candidate) === id)

      if (shiftKey && anchorIndex >= 0 && rowIndex >= 0) {
        const start = Math.min(anchorIndex, rowIndex)
        const end = Math.max(anchorIndex, rowIndex)
        for (const rangeRow of rows.slice(start, end + 1)) next.add(getId(rangeRow))
      } else if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      anchorIdRef.current = id
      return next
    })
  }, [getId, rows])

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const visibleIds = rows.map(getId)
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
      const next = new Set(current)
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
    anchorIdRef.current = null
  }, [getId, rows])

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(getId(row)))
  const someVisibleSelected = rows.some((row) => selectedIds.has(getId(row)))

  return {
    enabled,
    selectedIds,
    selectedRows,
    allVisibleSelected,
    someVisibleSelected,
    toggleRow,
    toggleAllVisible,
    clear,
  }
}
