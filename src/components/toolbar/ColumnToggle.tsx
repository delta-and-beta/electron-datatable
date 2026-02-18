import { useState } from 'react'
import { Columns3, Check, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDataTable } from '../../context'

interface ColumnToggleProps {
  className?: string
}

export function ColumnToggle({ className }: ColumnToggleProps) {
  const { columns, columnState } = useDataTable()
  const [open, setOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDropTargetId(id)
    }
  }

  function handleDragEnd() {
    if (draggedId && dropTargetId && draggedId !== dropTargetId) {
      const fromIndex = columnState.allColumns.indexOf(draggedId)
      const toIndex = columnState.allColumns.indexOf(dropTargetId)
      if (fromIndex !== -1 && toIndex !== -1) {
        columnState.reorderColumns(fromIndex, toIndex)
      }
    }
    setDraggedId(null)
    setDropTargetId(null)
  }

  function getColumnLabel(id: string): string {
    return columns.find((c) => c.id === id)?.label ?? id
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
          'border-gray-600 text-gray-300 hover:bg-gray-700',
          open && 'bg-gray-700',
        )}
      >
        <Columns3 className="w-4 h-4" />
        Columns
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 z-50 mt-1 w-[240px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs text-gray-400">Drag to reorder columns</span>
            </div>

            {/* Column list */}
            <div className="py-1 max-h-[300px] overflow-y-auto">
              {columnState.allColumns.map((id) => {
                const visible = columnState.isVisible(id)

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, id)}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => columnState.setColumnVisibility(id, !visible)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-700/50 transition-colors',
                      draggedId === id && 'opacity-50',
                      dropTargetId === id && draggedId !== null && draggedId !== id && 'border-t border-blue-500/50',
                    )}
                  >
                    {/* Drag handle */}
                    <span
                      className="cursor-grab text-gray-500 hover:text-gray-300 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>

                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        visible ? 'bg-blue-500 border-blue-500' : 'border-gray-600 bg-gray-700',
                      )}
                    >
                      {visible && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Label */}
                    <span className="text-xs text-gray-200 truncate">{getColumnLabel(id)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
