import { useState } from 'react'
import { X } from 'lucide-react'
import { useDataTable } from '../context'
import { cn } from '../lib/utils'
import type { BulkAction, RowData } from '../types'

export function BulkActionBar<T extends object = RowData>({
  actions,
}: {
  actions: BulkAction<T>[]
}) {
  const { selection } = useDataTable<T>()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  if (selection.selectedRows.length === 0) return null

  const runAction = async (action: BulkAction<T>) => {
    setPendingKey(action.key)
    try {
      await action.onClick(selection.selectedRows)
      selection.clear()
    } catch {
      // Keep the selection available so the consumer can retry a failed action.
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-12 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-dt-border bg-dt-bg-secondary px-3 py-2 text-sm text-dt-text shadow-xl"
    >
      <span className="whitespace-nowrap font-medium tabular-nums">
        {selection.selectedRows.length} selected
      </span>
      <span aria-hidden="true" className="h-5 w-px bg-dt-border" />
      {actions.map((action) => {
        if (action.show?.(selection.selectedRows) === false) return null

        return (
          <button
            key={action.key}
            type="button"
            disabled={pendingKey !== null}
            onClick={() => void runAction(action)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border border-dt-border px-2.5 font-medium transition-colors hover:bg-dt-bg',
              'disabled:cursor-wait disabled:opacity-60',
              action.variant === 'danger' &&
                'border-dt-negative/30 bg-dt-negative/10 text-dt-negative hover:bg-dt-negative/10',
            )}
          >
            {action.icon}
            {action.title}
          </button>
        )
      })}
      <button
        type="button"
        aria-label="Clear selection"
        onClick={selection.clear}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-dt-muted transition-colors hover:bg-dt-bg hover:text-dt-text"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

BulkActionBar.displayName = 'BulkActionBar'
