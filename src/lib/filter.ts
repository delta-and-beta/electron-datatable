import type { ColumnDef, FilterOperator, FilterCondition, FilterGroup } from '../types'
import { asRecord } from './as-record'

let idCounter = 0

function generateId(): string {
  return `f-${Date.now()}-${++idCounter}`
}

export function getOperatorsForColumnType(type: ColumnDef['type']): FilterOperator[] {
  switch (type) {
    case 'number':
    case 'currency':
      return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty']
    case 'date':
      return ['is', 'is_before', 'is_after', 'is_on_or_before', 'is_on_or_after', 'is_empty', 'is_not_empty']
    case 'text':
    case 'custom':
    default:
      return ['is', 'is_not', 'contains', 'does_not_contain', 'is_empty', 'is_not_empty']
  }
}

export function createEmptyCondition(field: string): FilterCondition {
  return { id: generateId(), field, operator: 'contains', value: '' }
}

export function createEmptyGroup(): FilterGroup {
  return { id: generateId(), conjunction: 'and', conditions: [], groups: [] }
}

export function getFilterDepth(group: FilterGroup): number {
  if (group.groups.length === 0) return 1
  return 1 + Math.max(...group.groups.map(getFilterDepth))
}

export function countConditions(group: FilterGroup): number {
  return group.conditions.length + group.groups.reduce((sum, g) => sum + countConditions(g), 0)
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function evaluateCondition<T extends object>(record: T, condition: FilterCondition, columns: ColumnDef<T>[]): boolean {
  const column = columns.find((c) => c.id === condition.field)
  if (!column) return true

  const rawValue = asRecord(record)[condition.field]

  if (condition.operator === 'is_empty') return isEmpty(rawValue)
  if (condition.operator === 'is_not_empty') return !isEmpty(rawValue)

  // Skip incomplete conditions (no value entered yet) — treat as "not configured"
  if (condition.value === '') return true

  const colType = column.type ?? 'text'

  switch (colType) {
    case 'number':
    case 'currency':
      return evaluateNumberCondition(rawValue, condition)
    case 'date':
      return evaluateDateCondition(rawValue, condition)
    case 'text':
    case 'custom':
    default:
      return evaluateTextCondition(rawValue, condition)
  }
}

function evaluateTextCondition(rawValue: unknown, condition: FilterCondition): boolean {
  const recordStr = rawValue == null ? '' : String(rawValue)
  const filterVal = condition.value

  switch (condition.operator) {
    case 'is': return recordStr === filterVal
    case 'is_not': return recordStr !== filterVal
    case 'contains': return recordStr.toLowerCase().includes(filterVal.toLowerCase())
    case 'does_not_contain': return !recordStr.toLowerCase().includes(filterVal.toLowerCase())
    default: return false
  }
}

function evaluateNumberCondition(rawValue: unknown, condition: FilterCondition): boolean {
  if (isEmpty(rawValue)) return false
  const num = Number(rawValue)
  const filterNum = parseFloat(condition.value)
  if (isNaN(num) || isNaN(filterNum)) return false

  switch (condition.operator) {
    case 'eq': return num === filterNum
    case 'neq': return num !== filterNum
    case 'gt': return num > filterNum
    case 'lt': return num < filterNum
    case 'gte': return num >= filterNum
    case 'lte': return num <= filterNum
    default: return false
  }
}

/** Local-time YYYY-MM-DD string — avoids UTC shift from toISOString() */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function evaluateDateCondition(rawValue: unknown, condition: FilterCondition): boolean {
  if (isEmpty(rawValue)) return false

  const recordDate = toDate(rawValue)
  const filterDate = toDate(condition.value)
  if (!recordDate || !filterDate) return false

  const rd = toLocalDateStr(recordDate)
  const fd = toLocalDateStr(filterDate)

  switch (condition.operator) {
    case 'is': return rd === fd
    case 'is_before': return rd < fd
    case 'is_after': return rd > fd
    case 'is_on_or_before': return rd <= fd
    case 'is_on_or_after': return rd >= fd
    default: return evaluateTextCondition(String(rawValue), condition)
  }
}

function evaluateGroup<T extends object>(record: T, group: FilterGroup, columns: ColumnDef<T>[]): boolean {
  const results: boolean[] = [
    ...group.conditions.map((c) => evaluateCondition(record, c, columns)),
    ...group.groups.map((g) => evaluateGroup(record, g, columns)),
  ]

  if (results.length === 0) return true

  return group.conjunction === 'and' ? results.every(Boolean) : results.some(Boolean)
}

export function filterRecords<T extends object>(
  records: T[],
  root: FilterGroup,
  columns: ColumnDef<T>[],
): T[] {
  if (countConditions(root) === 0) return records
  return records.filter((record) => evaluateGroup(record, root, columns))
}
