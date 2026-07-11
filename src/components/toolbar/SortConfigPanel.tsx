import { useState } from 'react'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ColumnDef } from '../../types'
import type { SortLevel } from '../../lib/sort'

interface SortConfigPanelProps {
  levels: SortLevel[]
  columns: ColumnDef[]
  onChange: (levels: SortLevel[]) => void
  onClose: () => void
}

const SORT_LABELS: Record<string, { asc: string; desc: string }> = {
  text: { asc: 'A → Z', desc: 'Z → A' },
  number: { asc: 'Low → High', desc: 'High → Low' },
  currency: { asc: 'Low → High', desc: 'High → Low' },
  date: { asc: 'Oldest first', desc: 'Newest first' },
  custom: { asc: 'A → Z', desc: 'Z → A' },
}

const MAX_LEVELS = 3

export function SortConfigPanel({ levels, columns, onChange }: SortConfigPanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const sortableColumns = columns.filter((c) => c.sortable !== false)
  const usedFields = new Set(levels.map((l) => l.field))
  const availableFields = sortableColumns.filter((c) => !usedFields.has(c.id))
  const canAddMore = levels.length < MAX_LEVELS && availableFields.length > 0

  const getType = (field: string) => columns.find((c) => c.id === field)?.type ?? 'text'
  const getLabel = (field: string) => columns.find((c) => c.id === field)?.label ?? field

  function update(index: number, patch: Partial<SortLevel>) {
    onChange(levels.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function remove(index: number) {
    onChange(levels.filter((_, i) => i !== index))
  }
  function add() {
    if (availableFields.length > 0) onChange([...levels, { field: availableFields[0].id, direction: 'asc' }])
  }
  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= levels.length) return
    const next = [...levels]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }
  function changeField(index: number, field: string) {
    update(index, { field, direction: getType(field) === 'date' ? 'desc' : 'asc' })
  }

  function handleDragStart(i: number) {
    setDragIndex(i)
  }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    setDropIndex(i)
  }
  function handleDragEnd() {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) reorder(dragIndex, dropIndex)
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-200">Sort by</span>
        {levels.length > 0 && (
          <button onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Clear all
          </button>
        )}
      </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {levels.length === 0 ? (
            <p className="text-xs text-gray-500 py-2 px-1">No sorting applied. Add a field to sort by.</p>
          ) : (
            levels.map((level, index) => {
              const labels = SORT_LABELS[getType(level.field)] ?? SORT_LABELS.text
              return (
                <div
                  key={`${level.field}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-700 bg-gray-750',
                    dragIndex === index && 'opacity-50',
                    dropIndex === index && dragIndex !== null && dragIndex !== index && 'border-blue-500/50',
                  )}
                >
                  <button className="cursor-grab text-gray-500 hover:text-gray-300 shrink-0" aria-label="Drag to reorder">
                    <GripVertical className="w-4 h-4" />
                  </button>

                  <span className="text-[10px] uppercase tracking-wider text-gray-500 w-10 shrink-0">
                    {index === 0 ? 'Sort' : 'then'}
                  </span>

                  <select
                    value={level.field}
                    onChange={(e) => changeField(index, e.target.value)}
                    className="flex-1 min-w-0 h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={level.field}>{getLabel(level.field)}</option>
                    {availableFields.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={level.direction}
                    onChange={(e) => update(index, { direction: e.target.value as 'asc' | 'desc' })}
                    className="w-[130px] h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="asc">{labels.asc}</option>
                    <option value="desc">{labels.desc}</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => reorder(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${getLabel(level.field)} up`}
                    className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M3 5l3-3 3 3" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(index, index + 1)}
                    disabled={index === levels.length - 1}
                    aria-label={`Move ${getLabel(level.field)} down`}
                    className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 10V2M3 7l3 3 3-3" /></svg>
                  </button>

                  <button
                    onClick={() => remove(index)}
                    className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${getLabel(level.field)} sort`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })
          )}

          {canAddMore && (
            <button
              onClick={add}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {levels.length === 0 ? 'Add sort' : 'Add tiebreaker'}
            </button>
          )}
        </div>
    </>
  )
}

SortConfigPanel.displayName = 'SortConfigPanel'
