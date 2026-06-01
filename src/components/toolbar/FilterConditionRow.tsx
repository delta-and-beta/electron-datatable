import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getOperatorsForColumnType } from '../../lib/filter'
import type { ColumnDef, FilterCondition, FilterOperator } from '../../types'

const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  eq: '=',
  neq: '\u2260',
  gt: '>',
  lt: '<',
  gte: '\u2265',
  lte: '\u2264',
}

interface FilterConditionRowProps {
  condition: FilterCondition
  columns: ColumnDef[]
  conjunctionLabel?: string
  isFirst: boolean
  onUpdate: (conditionId: string, updates: Partial<FilterCondition>) => void
  onRemove: (conditionId: string) => void
}

const selectClass = 'h-7 px-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500'

const needsValue = (op: string) => op !== 'is_empty' && op !== 'is_not_empty'

export function FilterConditionRow({
  condition,
  columns,
  conjunctionLabel,
  isFirst,
  onUpdate,
  onRemove,
}: FilterConditionRowProps) {
  const column = columns.find((c) => c.id === condition.field)
  const colType = column?.type ?? 'text'
  const operators = getOperatorsForColumnType(colType)

  function handleFieldChange(newField: string) {
    const newCol = columns.find((c) => c.id === newField)
    const newType = newCol?.type ?? 'text'
    const newOps = getOperatorsForColumnType(newType)
    const newOperator = newOps.includes(condition.operator) ? condition.operator : newOps[0]
    onUpdate(condition.id, { field: newField, operator: newOperator, value: '' })
  }

  function handleOperatorChange(newOp: FilterOperator) {
    const updates: Partial<FilterCondition> = { operator: newOp }
    if (!needsValue(newOp)) updates.value = ''
    onUpdate(condition.id, updates)
  }

  const valueInputType = colType === 'number' || colType === 'currency' ? 'number' : colType === 'date' ? 'date' : 'text'

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-gray-400 text-right">
        {isFirst ? 'Where' : conjunctionLabel ?? 'And'}
      </span>

      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className={cn(selectClass, 'flex-1 min-w-0')}
      >
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.label}
          </option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        className={cn(selectClass, 'w-[130px]')}
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op] ?? op}
          </option>
        ))}
      </select>

      {!needsValue(condition.operator) ? (
        <span className="flex-1" />
      ) : column?.options && column.options.length > 0 ? (
        // Airtable-style value dropdown for columns with a predefined option set
        <select
          value={String(condition.value ?? '')}
          onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
          className={cn(selectClass, 'flex-1 min-w-0')}
        >
          <option value="" disabled>
            Select…
          </option>
          {column.options.map((opt) => {
            const optValue = typeof opt === 'string' ? opt : opt.value
            const optLabel = typeof opt === 'string' ? opt : opt.label ?? opt.value
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            )
          })}
        </select>
      ) : (
        <input
          type={valueInputType}
          value={condition.value}
          onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
          placeholder="Value..."
          className={cn(selectClass, 'flex-1 min-w-0')}
        />
      )}

      <button
        onClick={() => onRemove(condition.id)}
        className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
        aria-label="Remove condition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
