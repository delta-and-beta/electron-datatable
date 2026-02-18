import { useState } from 'react'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { GroupLevel, ColumnDef, DatePeriod } from '../../types'

interface GroupByConfigPanelProps {
  levels: GroupLevel[]
  columns: ColumnDef[]
  onAddGroup: (field: string) => void
  onRemoveGroup: (index: number) => void
  onUpdateGroup: (index: number, updates: Partial<GroupLevel>) => void
  onReorderGroups: (fromIndex: number, toIndex: number) => void
  onCollapseAll: () => void
  onExpandAll: () => void
  showEmpty: boolean
  onToggleShowEmpty: (show: boolean) => void
  onClose: () => void
}

const SORT_LABELS: Record<string, { asc: string; desc: string }> = {
  text: { asc: 'A \u2192 Z', desc: 'Z \u2192 A' },
  number: { asc: 'Low \u2192 High', desc: 'High \u2192 Low' },
  currency: { asc: 'Low \u2192 High', desc: 'High \u2192 Low' },
  date: { asc: 'Oldest first', desc: 'Newest first' },
  custom: { asc: 'A \u2192 Z', desc: 'Z \u2192 A' },
}

const DATE_PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

const MAX_LEVELS = 3

export function GroupByConfigPanel({
  levels,
  columns,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
  onReorderGroups,
  onCollapseAll,
  onExpandAll,
  showEmpty,
  onToggleShowEmpty,
  onClose,
}: GroupByConfigPanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const usedFields = new Set(levels.map((l) => l.field))
  const availableFields = columns.filter((c) => c.groupable !== false && !usedFields.has(c.id))
  const canAddMore = levels.length < MAX_LEVELS && availableFields.length > 0

  function getColumnType(field: string): string {
    return columns.find((c) => c.id === field)?.type ?? 'text'
  }

  function getColumnLabel(field: string): string {
    return columns.find((c) => c.id === field)?.label ?? field
  }

  function handleFieldChange(index: number, newField: string) {
    const colType = getColumnType(newField)
    const updates: Partial<GroupLevel> = {
      field: newField,
      sort: colType === 'date' ? 'desc' : 'asc',
      datePeriod: colType === 'date' ? 'month' : undefined,
    }
    onUpdateGroup(index, updates)
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDropIndex(index)
  }

  function handleDragEnd() {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorderGroups(dragIndex, dropIndex)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleAddGroup() {
    if (availableFields.length > 0) {
      onAddGroup(availableFields[0].id)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute top-full left-0 z-50 mt-1 w-[420px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-200">Group by</span>
          {levels.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={onCollapseAll}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Collapse all
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={onExpandAll}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Expand all
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {levels.length === 0 ? (
            <p className="text-xs text-gray-500 py-2 px-1">
              No groups applied. Add a group to organize records.
            </p>
          ) : (
            levels.map((level, index) => {
              const colType = getColumnType(level.field)
              const sortLabels = SORT_LABELS[colType] ?? SORT_LABELS.text
              const isDateType = colType === 'date'

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
                  {/* Drag handle */}
                  <button className="cursor-grab text-gray-500 hover:text-gray-300 shrink-0" aria-label="Drag to reorder">
                    <GripVertical className="w-4 h-4" />
                  </button>

                  {/* Field selector */}
                  <select
                    value={level.field}
                    onChange={(e) => handleFieldChange(index, e.target.value)}
                    className="flex-1 min-w-0 h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={level.field}>{getColumnLabel(level.field)}</option>
                    {availableFields.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>

                  {/* Date period selector */}
                  {isDateType && (
                    <select
                      value={level.datePeriod ?? 'month'}
                      onChange={(e) => onUpdateGroup(index, { datePeriod: e.target.value as DatePeriod })}
                      className="w-[90px] h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                      {DATE_PERIODS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Sort direction */}
                  <select
                    value={level.sort}
                    onChange={(e) => onUpdateGroup(index, { sort: e.target.value as 'asc' | 'desc' })}
                    className="w-[110px] h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="asc">{sortLabels.asc}</option>
                    <option value="desc">{sortLabels.desc}</option>
                  </select>

                  {/* Delete button */}
                  <button
                    onClick={() => onRemoveGroup(index)}
                    className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${getColumnLabel(level.field)} group`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })
          )}

          {/* Add group button */}
          {canAddMore && (
            <button
              onClick={handleAddGroup}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {levels.length === 0 ? 'Add group' : 'Add subgroup'}
            </button>
          )}
        </div>

        {/* Footer: show empty groups toggle */}
        {levels.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-700">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmpty}
                onChange={(e) => onToggleShowEmpty(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-gray-400">Show empty groups</span>
            </label>
          </div>
        )}
      </div>
    </>
  )
}
