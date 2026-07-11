import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDropdownAlign } from '../../hooks/useDropdownAlign'
import { getFilterDepth } from '../../lib/filter'
import { FilterConditionRow } from './FilterConditionRow'
import type { ColumnDef, FilterGroup, FilterCondition } from '../../types'

const MAX_DEPTH = 3

interface FilterConfigPanelProps {
  root: FilterGroup
  columns: ColumnDef[]
  enabled: boolean
  onSetEnabled: (enabled: boolean) => void
  onAddCondition: (groupId: string, field: string) => void
  onRemoveCondition: (groupId: string, conditionId: string) => void
  onUpdateCondition: (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => void
  onAddGroup: (parentGroupId: string) => void
  onRemoveGroup: (groupId: string) => void
  onUpdateConjunction: (groupId: string, conjunction: 'and' | 'or') => void
  onClearAll: () => void
  onClose: () => void
}

function FilterGroupView({
  group,
  columns,
  depth,
  isRoot,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onAddGroup,
  onRemoveGroup,
  onUpdateConjunction,
}: {
  group: FilterGroup
  columns: ColumnDef[]
  depth: number
  isRoot: boolean
  onAddCondition: (groupId: string, field: string) => void
  onRemoveCondition: (groupId: string, conditionId: string) => void
  onUpdateCondition: (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => void
  onAddGroup: (parentGroupId: string) => void
  onRemoveGroup: (groupId: string) => void
  onUpdateConjunction: (groupId: string, conjunction: 'and' | 'or') => void
}) {
  const filterableColumns = columns.filter((c) => c.filterable !== false)
  const defaultField = filterableColumns[0]?.id ?? ''
  const conjunctionLabel = group.conjunction === 'and' ? 'And' : 'Or'
  const canAddGroup = depth < MAX_DEPTH

  const depthColors = [
    'border-gray-600',
    'border-blue-500/40',
    'border-dt-badge-warning/40',
  ]
  const borderColor = depthColors[depth - 1] ?? depthColors[0]

  const content = (
    <div className="space-y-2">
      {(group.conditions.length + group.groups.length) > 1 && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            {group.conjunction === 'and' ? 'All of the following are true...' : 'Any of the following are true...'}
          </span>
        </div>
      )}

      {group.conditions.map((condition, index) => (
        <FilterConditionRow
          key={condition.id}
          condition={condition}
          columns={filterableColumns}
          conjunctionLabel={conjunctionLabel}
          isFirst={index === 0 && group.groups.length === 0}
          onUpdate={(conditionId, updates) => onUpdateCondition(group.id, conditionId, updates)}
          onRemove={(conditionId) => onRemoveCondition(group.id, conditionId)}
        />
      ))}

      {group.groups.map((subgroup) => (
        <FilterGroupView
          key={subgroup.id}
          group={subgroup}
          columns={columns}
          depth={depth + 1}
          isRoot={false}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUpdateCondition={onUpdateCondition}
          onAddGroup={onAddGroup}
          onRemoveGroup={onRemoveGroup}
          onUpdateConjunction={onUpdateConjunction}
        />
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onAddCondition(group.id, defaultField)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add condition
        </button>
        {canAddGroup && (
          <button
            onClick={() => onAddGroup(group.id)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add condition group
          </button>
        )}
      </div>
    </div>
  )

  if (isRoot) return content

  return (
    <div className={cn('relative pl-3 ml-6 border-l-2 rounded-sm py-2', borderColor)}>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onUpdateConjunction(group.id, group.conjunction === 'and' ? 'or' : 'and')}
          className="text-xs font-medium px-2 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          {conjunctionLabel}
        </button>
        <button
          onClick={() => onRemoveGroup(group.id)}
          className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
          aria-label="Remove condition group"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {content}
    </div>
  )
}

export function FilterConfigPanel({
  root,
  columns,
  enabled,
  onSetEnabled,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onAddGroup,
  onRemoveGroup,
  onUpdateConjunction,
  onClearAll,
  onClose,
}: FilterConfigPanelProps) {
  const { ref: panelRef, alignRight } = useDropdownAlign()
  const totalConditions = root.conditions.length + root.groups.reduce(
    (sum, g) => sum + g.conditions.length, 0,
  )

  useEffect(() => {
    if (panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>('button, input, select, [tabindex]')
      first?.focus()
    }
  }, [panelRef])

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-label="Filter configuration" onKeyDown={handlePanelKeyDown} className={cn("absolute top-full z-50 mt-1 w-[520px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl", alignRight ? 'right-0' : 'left-0')}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-200">Filters</span>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onSetEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-gray-400">Enabled</span>
            </label>
          </div>
          {totalConditions > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {(root.conditions.length + root.groups.length) > 1 && (
          <div className="px-4 pt-3">
            <button
              onClick={() => onUpdateConjunction(root.id, root.conjunction === 'and' ? 'or' : 'and')}
              className="text-xs font-medium px-2 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {root.conjunction === 'and' ? 'And' : 'Or'}
            </button>
          </div>
        )}

        <div className="p-4 space-y-2">
          <FilterGroupView
            group={root}
            columns={columns}
            depth={1}
            isRoot={true}
            onAddCondition={onAddCondition}
            onRemoveCondition={onRemoveCondition}
            onUpdateCondition={onUpdateCondition}
            onAddGroup={onAddGroup}
            onRemoveGroup={onRemoveGroup}
            onUpdateConjunction={onUpdateConjunction}
          />
        </div>
      </div>
    </>
  )
}
