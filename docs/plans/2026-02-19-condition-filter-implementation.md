# Condition-Based Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Airtable-style condition-based filtering — nested condition groups with And/Or conjunctions, type-aware operators, localStorage persistence, and a filter config UI panel.

**Architecture:** New filter types in `src/types.ts`, pure filter logic in `src/lib/filter.ts`, a `useFilter` hook following the same pattern as `useGroupBy`/`useSort`, three UI components (button, panel, condition row), and integration into the DataTable compound component pipeline as `filter → search → sort → groupBy`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS with `dt-*` tokens, lucide-react icons, vitest

---

### Task 1: Add Filter Types

**Files:**
- Modify: `src/types.ts:60` (after GroupedSection, before AttachmentAdapter)

**Step 1: Add filter type definitions to `src/types.ts`**

Add after the `GroupedSection` interface (line 60) and before `AttachmentAdapter` (line 62):

```typescript
/** Filter operators for text columns */
export type TextOperator = 'is' | 'is_not' | 'contains' | 'does_not_contain' | 'is_empty' | 'is_not_empty'

/** Filter operators for number/currency columns */
export type NumberOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty'

/** Filter operators for date columns */
export type DateOperator = 'is' | 'is_before' | 'is_after' | 'is_on_or_before' | 'is_on_or_after' | 'is_empty' | 'is_not_empty'

/** Union of all filter operators */
export type FilterOperator = TextOperator | NumberOperator | DateOperator

/** A single filter condition: field + operator + value */
export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
}

/** A group of conditions joined by a single conjunction, with optional nested sub-groups */
export interface FilterGroup {
  id: string
  conjunction: 'and' | 'or'
  conditions: FilterCondition[]
  groups: FilterGroup[]
}

/** Root filter configuration (persisted to localStorage) */
export interface FilterConfig {
  root: FilterGroup
  enabled: boolean
}
```

Also add a `filterable?: boolean` property to `ColumnDef` in the behavior section (after line 25 `visible?: boolean`):

```typescript
  filterable?: boolean
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors, types are only added)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(filter): add filter condition and group types"
```

---

### Task 2: Pure Filter Logic — Helpers and Text Operators

**Files:**
- Create: `src/lib/filter.ts`
- Create: `src/lib/filter.test.ts`

**Step 1: Write failing tests for helpers and text operators**

Create `src/lib/filter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  filterRecords,
  getOperatorsForColumnType,
  createEmptyCondition,
  createEmptyGroup,
  getFilterDepth,
  countConditions,
} from './filter'
import type { FilterGroup, ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'date', label: 'Date', type: 'date' },
  { id: 'price', label: 'Price', type: 'currency' },
  { id: 'custom', label: 'Custom', type: 'custom' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100, date: '2024-01-15', price: 50 },
  { id: '2', name: 'Bob', amount: 200, date: '2024-03-20', price: 75 },
  { id: '3', name: 'Charlie', amount: 50, date: '2024-06-10', price: 100 },
  { id: '4', name: '', amount: 0, date: '', price: 0 },
  { id: '5', name: 'alice', amount: null, date: null, price: null },
]

describe('getOperatorsForColumnType', () => {
  it('returns text operators for text type', () => {
    const ops = getOperatorsForColumnType('text')
    expect(ops).toContain('is')
    expect(ops).toContain('contains')
    expect(ops).toContain('is_empty')
    expect(ops).not.toContain('gt')
  })

  it('returns number operators for number type', () => {
    const ops = getOperatorsForColumnType('number')
    expect(ops).toContain('eq')
    expect(ops).toContain('gt')
    expect(ops).not.toContain('contains')
  })

  it('returns date operators for date type', () => {
    const ops = getOperatorsForColumnType('date')
    expect(ops).toContain('is_before')
    expect(ops).toContain('is_after')
    expect(ops).not.toContain('gt')
  })

  it('returns number operators for currency type', () => {
    const ops = getOperatorsForColumnType('currency')
    expect(ops).toContain('gt')
    expect(ops).toContain('lte')
  })

  it('returns text operators for custom type', () => {
    const ops = getOperatorsForColumnType('custom')
    expect(ops).toContain('contains')
  })
})

describe('createEmptyCondition', () => {
  it('creates a condition with default operator "contains"', () => {
    const cond = createEmptyCondition('name')
    expect(cond.field).toBe('name')
    expect(cond.operator).toBe('contains')
    expect(cond.value).toBe('')
    expect(cond.id).toBeTruthy()
  })
})

describe('createEmptyGroup', () => {
  it('creates a group with "and" conjunction and empty arrays', () => {
    const group = createEmptyGroup()
    expect(group.conjunction).toBe('and')
    expect(group.conditions).toEqual([])
    expect(group.groups).toEqual([])
    expect(group.id).toBeTruthy()
  })
})

describe('getFilterDepth', () => {
  it('returns 1 for a flat group', () => {
    const group = createEmptyGroup()
    expect(getFilterDepth(group)).toBe(1)
  })

  it('returns 2 for one level of nesting', () => {
    const group = createEmptyGroup()
    group.groups = [createEmptyGroup()]
    expect(getFilterDepth(group)).toBe(2)
  })

  it('returns 3 for two levels of nesting', () => {
    const group = createEmptyGroup()
    const child = createEmptyGroup()
    child.groups = [createEmptyGroup()]
    group.groups = [child]
    expect(getFilterDepth(group)).toBe(3)
  })
})

describe('countConditions', () => {
  it('returns 0 for empty group', () => {
    expect(countConditions(createEmptyGroup())).toBe(0)
  })

  it('counts conditions across nested groups', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conditions: [createEmptyCondition('name')],
      groups: [{
        ...createEmptyGroup(),
        conditions: [createEmptyCondition('amount'), createEmptyCondition('date')],
        groups: [],
      }],
    }
    expect(countConditions(group)).toBe(3)
  })
})

describe('filterRecords — text operators', () => {
  function makeGroup(conditions: FilterGroup['conditions']): FilterGroup {
    return { ...createEmptyGroup(), conditions }
  }

  it('is — case-sensitive exact match', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'is', value: 'Alice' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('is — case-sensitive, does not match different case', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'is', value: 'alice' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['5'])
  })

  it('is_not — excludes exact match', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'is_not', value: 'Alice' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['2', '3', '4', '5'])
  })

  it('contains — case-insensitive substring', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'contains', value: 'ali' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '5'])
  })

  it('does_not_contain — case-insensitive exclusion', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'does_not_contain', value: 'ali' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['2', '3', '4'])
  })

  it('is_empty — matches null, undefined, and empty string', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'is_empty', value: '' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['4'])
  })

  it('is_not_empty — excludes null, undefined, and empty string', () => {
    const group = makeGroup([{ id: '1', field: 'name', operator: 'is_not_empty', value: '' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2', '3', '5'])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/filter.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement filter.ts with helpers and text operator evaluation**

Create `src/lib/filter.ts`:

```typescript
import type { RowData, ColumnDef, FilterOperator, FilterCondition, FilterGroup } from '../types'

let idCounter = 0

/** Generate a unique ID for filter conditions and groups */
function generateId(): string {
  return `f-${Date.now()}-${++idCounter}`
}

/** Get available operators for a column type */
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

/** Create an empty filter condition for a field */
export function createEmptyCondition(field: string): FilterCondition {
  return { id: generateId(), field, operator: 'contains', value: '' }
}

/** Create an empty filter group with 'and' conjunction */
export function createEmptyGroup(): FilterGroup {
  return { id: generateId(), conjunction: 'and', conditions: [], groups: [] }
}

/** Get the maximum nesting depth of a filter group (1 = flat, 3 = max) */
export function getFilterDepth(group: FilterGroup): number {
  if (group.groups.length === 0) return 1
  return 1 + Math.max(...group.groups.map(getFilterDepth))
}

/** Count total conditions across a group and all nested sub-groups */
export function countConditions(group: FilterGroup): number {
  return group.conditions.length + group.groups.reduce((sum, g) => sum + countConditions(g), 0)
}

/** Check if a value is empty (null, undefined, or empty string) */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

/** Evaluate a single condition against a record */
function evaluateCondition(
  record: RowData,
  condition: FilterCondition,
  columns: ColumnDef[],
): boolean {
  const column = columns.find((c) => c.id === condition.field)
  if (!column) return true // unknown field — don't filter out

  const rawValue = record[condition.field]

  // Handle empty checks first — works for all types
  if (condition.operator === 'is_empty') return isEmpty(rawValue)
  if (condition.operator === 'is_not_empty') return !isEmpty(rawValue)

  const colType = column.type

  if (colType === 'text' || colType === 'custom') {
    return evaluateTextCondition(rawValue, condition)
  }
  if (colType === 'number' || colType === 'currency') {
    return evaluateNumberCondition(rawValue, condition)
  }
  if (colType === 'date') {
    return evaluateDateCondition(rawValue, condition)
  }

  return true
}

/** Evaluate text operators */
function evaluateTextCondition(rawValue: unknown, condition: FilterCondition): boolean {
  const recordStr = rawValue == null ? '' : String(rawValue)
  const filterVal = condition.value

  switch (condition.operator) {
    case 'is':
      return recordStr === filterVal
    case 'is_not':
      return recordStr !== filterVal
    case 'contains':
      return recordStr.toLowerCase().includes(filterVal.toLowerCase())
    case 'does_not_contain':
      return !recordStr.toLowerCase().includes(filterVal.toLowerCase())
    default:
      return true
  }
}

/** Evaluate number/currency operators */
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
    default: return true
  }
}

/** Evaluate date operators */
function evaluateDateCondition(rawValue: unknown, condition: FilterCondition): boolean {
  if (isEmpty(rawValue)) return false
  const recordDate = new Date(rawValue as string)
  const filterDate = new Date(condition.value)
  if (isNaN(recordDate.getTime()) || isNaN(filterDate.getTime())) return false

  // Compare dates at day granularity
  const rd = recordDate.toISOString().slice(0, 10)
  const fd = filterDate.toISOString().slice(0, 10)

  switch (condition.operator) {
    case 'is': return rd === fd
    case 'is_before': return rd < fd
    case 'is_after': return rd > fd
    case 'is_on_or_before': return rd <= fd
    case 'is_on_or_after': return rd >= fd
    default: return true
  }
}

/** Evaluate a filter group against a single record (recursive) */
function evaluateGroup(
  record: RowData,
  group: FilterGroup,
  columns: ColumnDef[],
): boolean {
  const results: boolean[] = [
    ...group.conditions.map((c) => evaluateCondition(record, c, columns)),
    ...group.groups.map((g) => evaluateGroup(record, g, columns)),
  ]

  // No conditions or groups — pass through
  if (results.length === 0) return true

  return group.conjunction === 'and'
    ? results.every(Boolean)
    : results.some(Boolean)
}

/** Filter records using a nested condition group tree */
export function filterRecords<T extends RowData>(
  records: T[],
  root: FilterGroup,
  columns: ColumnDef<T>[],
): T[] {
  // No conditions at all — return everything
  if (countConditions(root) === 0) return records
  return records.filter((record) => evaluateGroup(record, root, columns as ColumnDef[]))
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/filter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/filter.ts src/lib/filter.test.ts
git commit -m "feat(filter): add pure filter logic with text operators and helpers"
```

---

### Task 3: Filter Logic — Number, Date, and Group Tests

**Files:**
- Modify: `src/lib/filter.test.ts` (append new describe blocks)

**Step 1: Add tests for number, date operators and nested groups**

Append to `src/lib/filter.test.ts`:

```typescript
describe('filterRecords — number operators', () => {
  function makeGroup(conditions: FilterGroup['conditions']): FilterGroup {
    return { ...createEmptyGroup(), conditions }
  }

  it('eq — exact numeric match', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'eq', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('neq — not equal', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'neq', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['2', '3'])
  })

  it('gt — greater than', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gt', value: '75' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('lt — less than', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'lt', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['3'])
  })

  it('gte — greater than or equal', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gte', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('lte — less than or equal', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'lte', value: '50' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['3'])
  })

  it('is_empty — matches null values in number fields', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'is_empty', value: '' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['5'])
  })

  it('skips records with null when comparing numbers', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gt', value: '0' }])
    const result = filterRecords(data, group, columns)
    // id 4 has amount=0, id 5 has amount=null (excluded)
    expect(result.map((r) => r.id)).toEqual(['1', '2', '3'])
  })
})

describe('filterRecords — date operators', () => {
  function makeGroup(conditions: FilterGroup['conditions']): FilterGroup {
    return { ...createEmptyGroup(), conditions }
  }

  it('is — exact date match', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is', value: '2024-01-15' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('is_before — records before date', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is_before', value: '2024-03-01' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('is_after — records after date', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is_after', value: '2024-03-01' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['2', '3'])
  })

  it('is_on_or_before — inclusive', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is_on_or_before', value: '2024-03-20' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('is_on_or_after — inclusive', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is_on_or_after', value: '2024-03-20' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['2', '3'])
  })

  it('is_empty — matches empty/null dates', () => {
    const group = makeGroup([{ id: '1', field: 'date', operator: 'is_empty', value: '' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['4', '5'])
  })
})

describe('filterRecords — conjunctions and nested groups', () => {
  it('AND conjunction — all conditions must match', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'and',
      conditions: [
        { id: '1', field: 'name', operator: 'contains', value: 'a' },
        { id: '2', field: 'amount', operator: 'gt', value: '50' },
      ],
    }
    const result = filterRecords(data, group, columns)
    // Alice (amount 100) matches both; alice (amount null) fails number check
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('OR conjunction — any condition can match', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'or',
      conditions: [
        { id: '1', field: 'name', operator: 'is', value: 'Alice' },
        { id: '2', field: 'name', operator: 'is', value: 'Bob' },
      ],
    }
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('nested groups — AND with OR subgroup', () => {
    // "Name contains 'a' AND (amount > 150 OR amount < 60)"
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'and',
      conditions: [
        { id: '1', field: 'name', operator: 'contains', value: 'a' },
      ],
      groups: [{
        ...createEmptyGroup(),
        conjunction: 'or',
        conditions: [
          { id: '2', field: 'amount', operator: 'gt', value: '150' },
          { id: '3', field: 'amount', operator: 'lt', value: '60' },
        ],
      }],
    }
    const result = filterRecords(data, group, columns)
    // Charlie: contains 'a', amount 50 < 60 ✓
    // Alice: contains 'a', amount 100 — neither >150 nor <60 ✗
    expect(result.map((r) => r.id)).toEqual(['3'])
  })

  it('returns all records when no conditions exist', () => {
    const group = createEmptyGroup()
    const result = filterRecords(data, group, columns)
    expect(result).toHaveLength(data.length)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/filter.test.ts`
Expected: PASS (implementation from Task 2 already handles all operators)

**Step 3: Commit**

```bash
git add src/lib/filter.test.ts
git commit -m "test(filter): add number, date, and nested group tests"
```

---

### Task 4: useFilter Hook

**Files:**
- Create: `src/hooks/useFilter.ts`

**Step 1: Implement the useFilter hook**

Create `src/hooks/useFilter.ts`. Follow the pattern from `src/hooks/useGroupBy.ts` (localStorage persistence, memoized computation, useCallback mutation helpers).

```typescript
import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RowData, ColumnDef, FilterGroup, FilterConfig, FilterCondition } from '../types'
import { filterRecords, createEmptyGroup, createEmptyCondition, countConditions, getFilterDepth } from '../lib/filter'

const MAX_DEPTH = 3

interface UseFilterOptions<T extends RowData> {
  data: T[]
  columns: ColumnDef<T>[]
  storageKey?: string
}

/** Recursively find and update a group by ID within the tree */
function updateGroupInTree(root: FilterGroup, groupId: string, updater: (group: FilterGroup) => FilterGroup): FilterGroup {
  if (root.id === groupId) return updater(root)
  return {
    ...root,
    groups: root.groups.map((g) => updateGroupInTree(g, groupId, updater)),
  }
}

/** Recursively remove a group by ID from the tree */
function removeGroupFromTree(root: FilterGroup, groupId: string): FilterGroup {
  return {
    ...root,
    groups: root.groups
      .filter((g) => g.id !== groupId)
      .map((g) => removeGroupFromTree(g, groupId)),
  }
}

/** Recursively find the depth of a specific group within the tree */
function findGroupDepth(root: FilterGroup, groupId: string, currentDepth: number = 1): number {
  if (root.id === groupId) return currentDepth
  for (const g of root.groups) {
    const depth = findGroupDepth(g, groupId, currentDepth + 1)
    if (depth > 0) return depth
  }
  return 0
}

/** Validate that all condition field IDs exist in columns */
function validateFilterGroup(group: FilterGroup, validFields: Set<string>): FilterGroup {
  return {
    ...group,
    conditions: group.conditions.filter((c) => validFields.has(c.field)),
    groups: group.groups.map((g) => validateFilterGroup(g, validFields)),
  }
}

export function useFilter<T extends RowData>({
  data,
  columns,
  storageKey,
}: UseFilterOptions<T>) {
  const fullKey = storageKey ? `${storageKey}-filters` : null

  const [root, setRoot] = useState<FilterGroup>(() => {
    if (!fullKey) return createEmptyGroup()
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config: FilterConfig = JSON.parse(saved)
        const validFields = new Set(columns.filter((c) => c.filterable !== false).map((c) => c.id))
        return validateFilterGroup(config.root, validFields)
      }
    } catch {
      // ignore
    }
    return createEmptyGroup()
  })

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!fullKey) return true
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config: FilterConfig = JSON.parse(saved)
        return config.enabled
      }
    } catch {
      // ignore
    }
    return true
  })

  // Persist to localStorage
  useEffect(() => {
    if (!fullKey) return
    const config: FilterConfig = { root, enabled }
    try {
      localStorage.setItem(fullKey, JSON.stringify(config))
    } catch {
      // ignore quota errors
    }
  }, [fullKey, root, enabled])

  // Compute filtered data
  const filteredData = useMemo(() => {
    if (!enabled || countConditions(root) === 0) return data
    return filterRecords(data, root, columns)
  }, [data, root, enabled, columns])

  const activeCount = useMemo(() => countConditions(root), [root])

  // Mutation helpers
  const addCondition = useCallback((groupId: string, field: string) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: [...g.conditions, createEmptyCondition(field)],
      })),
    )
  }, [])

  const removeCondition = useCallback((groupId: string, conditionId: string) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: g.conditions.filter((c) => c.id !== conditionId),
      })),
    )
  }, [])

  const updateCondition = useCallback((groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({
        ...g,
        conditions: g.conditions.map((c) => (c.id === conditionId ? { ...c, ...updates } : c)),
      })),
    )
  }, [])

  const addGroup = useCallback((parentGroupId: string) => {
    setRoot((prev) => {
      const parentDepth = findGroupDepth(prev, parentGroupId)
      if (parentDepth >= MAX_DEPTH) return prev
      return updateGroupInTree(prev, parentGroupId, (g) => ({
        ...g,
        groups: [...g.groups, createEmptyGroup()],
      }))
    })
  }, [])

  const removeGroup = useCallback((groupId: string) => {
    setRoot((prev) => removeGroupFromTree(prev, groupId))
  }, [])

  const updateConjunction = useCallback((groupId: string, conjunction: 'and' | 'or') => {
    setRoot((prev) =>
      updateGroupInTree(prev, groupId, (g) => ({ ...g, conjunction })),
    )
  }, [])

  const clearAll = useCallback(() => {
    setRoot(createEmptyGroup())
  }, [])

  return {
    root,
    filteredData,
    enabled,
    setEnabled,
    activeCount,
    addCondition,
    removeCondition,
    updateCondition,
    addGroup,
    removeGroup,
    updateConjunction,
    clearAll,
  }
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useFilter.ts
git commit -m "feat(filter): add useFilter hook with localStorage persistence"
```

---

### Task 5: FilterConditionRow Component

**Files:**
- Create: `src/components/toolbar/FilterConditionRow.tsx`

**Step 1: Implement the condition row component**

Create `src/components/toolbar/FilterConditionRow.tsx`. Follow styling patterns from `src/components/toolbar/GroupByConfigPanel.tsx` (same select styles, button styles, icon sizes).

```typescript
import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getOperatorsForColumnType } from '../../lib/filter'
import type { ColumnDef, FilterCondition, FilterOperator } from '../../types'

const OPERATOR_LABELS: Record<string, string> = {
  // Text
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  does_not_contain: 'does not contain',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  // Number
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
    // Reset operator if current one isn't valid for new type
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
      {/* Conjunction label or "Where" */}
      <span className="w-14 shrink-0 text-xs text-gray-400 text-right">
        {isFirst ? 'Where' : conjunctionLabel ?? 'And'}
      </span>

      {/* Field selector */}
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

      {/* Operator selector */}
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

      {/* Value input */}
      {needsValue(condition.operator) ? (
        <input
          type={valueInputType}
          value={condition.value}
          onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
          placeholder="Value..."
          className={cn(selectClass, 'flex-1 min-w-0')}
        />
      ) : (
        <span className="flex-1" />
      )}

      {/* Delete button */}
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
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/toolbar/FilterConditionRow.tsx
git commit -m "feat(filter): add FilterConditionRow component"
```

---

### Task 6: FilterConfigPanel Component

**Files:**
- Create: `src/components/toolbar/FilterConfigPanel.tsx`

**Step 1: Implement the filter config panel**

Create `src/components/toolbar/FilterConfigPanel.tsx`. This renders the recursive group tree. Follows the backdrop + absolute panel pattern from `src/components/toolbar/GroupByConfigPanel.tsx`.

```typescript
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
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
    'border-amber-500/40',
  ]
  const borderColor = depthColors[depth - 1] ?? depthColors[0]

  const content = (
    <div className="space-y-2">
      {/* Conjunction toggle for non-root or when group has >1 item */}
      {(group.conditions.length + group.groups.length) > 1 && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            {group.conjunction === 'and' ? 'All of the following are true...' : 'Any of the following are true...'}
          </span>
        </div>
      )}

      {/* Condition rows */}
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

      {/* Nested groups */}
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

      {/* Action buttons */}
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
  const totalConditions = root.conditions.length + root.groups.reduce(
    (sum, g) => sum + g.conditions.length, 0,
  )

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute top-full left-0 z-50 mt-1 w-[520px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
        {/* Header */}
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

        {/* Root conjunction toggle */}
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

        {/* Content */}
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
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/toolbar/FilterConfigPanel.tsx
git commit -m "feat(filter): add FilterConfigPanel with recursive group rendering"
```

---

### Task 7: FilterToolbarButton Component

**Files:**
- Create: `src/components/toolbar/FilterToolbarButton.tsx`

**Step 1: Implement the toolbar button**

Create `src/components/toolbar/FilterToolbarButton.tsx`. Follow the pattern from `src/components/toolbar/GroupByToolbarButton.tsx`.

```typescript
import { Filter } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FilterToolbarButtonProps {
  activeCount: number
  enabled: boolean
  isOpen: boolean
  onClick: () => void
  onToggleEnabled: (enabled: boolean) => void
  className?: string
}

export function FilterToolbarButton({
  activeCount,
  enabled,
  isOpen,
  onClick,
  onToggleEnabled,
  className,
}: FilterToolbarButtonProps) {
  const isActive = activeCount > 0 && enabled

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
          'border-gray-600 text-gray-300 hover:bg-gray-700',
          isActive && 'border-dt-primary/50 text-dt-primary',
          isOpen && 'bg-gray-700',
          className,
        )}
      >
        <Filter className="w-4 h-4" />
        {isActive
          ? `${activeCount} filter${activeCount > 1 ? 's' : ''}`
          : 'Filter'}
      </button>
      {activeCount > 0 && (
        <button
          onClick={() => onToggleEnabled(!enabled)}
          className={cn(
            'h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors text-xs',
            enabled
              ? 'border-dt-primary/50 text-dt-primary hover:bg-gray-700'
              : 'border-gray-600 text-gray-500 hover:bg-gray-700',
          )}
          aria-label={enabled ? 'Disable filters' : 'Enable filters'}
          title={enabled ? 'Disable filters' : 'Enable filters'}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      )}
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/toolbar/FilterToolbarButton.tsx
git commit -m "feat(filter): add FilterToolbarButton component"
```

---

### Task 8: Integration — Wire Filter into DataTable

**Files:**
- Modify: `src/context.ts:5` (add import)
- Modify: `src/context.ts:7-39` (add filter to context value)
- Modify: `src/components/DataTable.tsx` (add useFilter to pipeline, update FullPreset, add static props)
- Modify: `src/components/toolbar/index.ts` (add barrel exports)
- Modify: `src/index.ts` (add all new exports)

**Step 1: Update context.ts**

Add import for useFilter on line 5 (after the useSort import):

```typescript
import type { useFilter } from './hooks/useFilter'
```

Add filter field to `DataTableContextValue` after the group-by section (after line 26 `groupBy: ReturnType<typeof useGroupBy<T>>`):

```typescript
  // Condition filter
  filter: ReturnType<typeof useFilter<T>>
```

**Step 2: Update DataTable.tsx**

Add import for useFilter (after line 9 `import { useSort } from '../hooks/useSort'`):

```typescript
import { useFilter } from '../hooks/useFilter'
```

Add imports for new filter components (after the DateFilter import on line 17):

```typescript
import { FilterToolbarButton } from './toolbar/FilterToolbarButton'
import { FilterConfigPanel } from './toolbar/FilterConfigPanel'
```

Rewrite the hook pipeline in `DataTableRoot` (lines 34-58). The new order is: filter → search → sort → columns → groupBy:

```typescript
  // Filter (condition-based)
  const filter = useFilter({ data, columns, storageKey })

  // Search (free-text, on filtered data)
  const search = useSearch({ data: filter.filteredData, columns })

  // Sort
  const sort = useSort({
    data: search.filteredData,
    defaultField: defaultSort?.field,
    defaultDirection: defaultSort?.direction,
    storageKey,
  })

  // Columns
  const columnState = useColumns({ columns, storageKey })

  // Group-by
  const sumFields = columns
    .filter((c) => c.sumInGroup !== false && (c.type === 'number' || c.type === 'currency'))
    .map((c) => c.id)

  const groupBy = useGroupBy({
    data: sort.sortedData,
    columns,
    sumFields,
    storageKey,
  })
```

Add `filter` to the context value object (after `groupBy,` on line 82):

```typescript
      filter,
```

Add `filter` to the useMemo dependency array (after `groupBy,` on line 100):

```typescript
      filter,
```

Update `FullPreset` to add filter menu state (after line 141 `const [groupMenuOpen, setGroupMenuOpen] = useState(false)`):

```typescript
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
```

Pass filter state to FullPresetToolbar:

```typescript
      <FullPresetToolbar
        groupMenuOpen={groupMenuOpen}
        setGroupMenuOpen={setGroupMenuOpen}
        filterMenuOpen={filterMenuOpen}
        setFilterMenuOpen={setFilterMenuOpen}
      />
```

Update `FullPresetToolbar` props and add filter button. Add these props:

```typescript
  filterMenuOpen: boolean
  setFilterMenuOpen: (open: boolean) => void
```

Add to the toolbar, the filter button should go before the group-by button. Inside the toolbar return, add a `<div className="relative">` block for the filter button + panel, mirroring the group-by pattern:

```typescript
        <div className="relative">
          <FilterToolbarButton
            activeCount={filter.activeCount}
            enabled={filter.enabled}
            isOpen={filterMenuOpen}
            onClick={() => setFilterMenuOpen(!filterMenuOpen)}
            onToggleEnabled={filter.setEnabled}
          />
          {filterMenuOpen && (
            <FilterConfigPanel
              root={filter.root}
              columns={columns}
              enabled={filter.enabled}
              onSetEnabled={filter.setEnabled}
              onAddCondition={filter.addCondition}
              onRemoveCondition={filter.removeCondition}
              onUpdateCondition={filter.updateCondition}
              onAddGroup={filter.addGroup}
              onRemoveGroup={filter.removeGroup}
              onUpdateConjunction={filter.updateConjunction}
              onClearAll={filter.clearAll}
              onClose={() => setFilterMenuOpen(false)}
            />
          )}
        </div>
```

Also destructure `filter` from `useDataTable()` in `FullPresetToolbar`:

```typescript
  const { groupBy, filter, columns } = useDataTable()
```

Update the compound component static properties (line 200) to add:

```typescript
  Filter: FilterToolbarButton,
  FilterPanel: FilterConfigPanel,
```

**Step 3: Update barrel exports**

Add to `src/components/toolbar/index.ts`:

```typescript
export { FilterToolbarButton } from './FilterToolbarButton'
export { FilterConfigPanel } from './FilterConfigPanel'
export { FilterConditionRow } from './FilterConditionRow'
```

**Step 4: Update src/index.ts**

Add filter types to the type exports block:

```typescript
export type {
  // ... existing exports ...
  TextOperator,
  NumberOperator,
  DateOperator,
  FilterOperator,
  FilterCondition,
  FilterGroup,
  FilterConfig,
} from './types'
```

Add pure logic exports (after the group-by exports):

```typescript
export { filterRecords, getOperatorsForColumnType, createEmptyCondition, createEmptyGroup, getFilterDepth, countConditions } from './lib/filter'
```

Add hook export (after the existing hook exports):

```typescript
export { useFilter } from './hooks/useFilter'
```

Add component exports (after the existing toolbar component exports):

```typescript
export { FilterToolbarButton } from './components/toolbar/FilterToolbarButton'
export { FilterConfigPanel } from './components/toolbar/FilterConfigPanel'
export { FilterConditionRow } from './components/toolbar/FilterConditionRow'
```

**Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: PASS (all existing tests + new filter tests)

**Step 7: Build**

Run: `npm run build`
Expected: PASS (clean build with no errors)

**Step 8: Commit**

```bash
git add src/context.ts src/components/DataTable.tsx src/components/toolbar/index.ts src/index.ts
git commit -m "feat(filter): wire filter into DataTable pipeline and exports"
```

---

### Task 9: Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Build**

Run: `npm run build`
Expected: Clean build

**Step 4: Verify exports**

Run: `node -e "const m = require('./dist/index.cjs'); console.log(Object.keys(m).filter(k => k.includes('ilter')).sort())"`
Expected: Prints array including `FilterConfigPanel`, `FilterConditionRow`, `FilterToolbarButton`, `countConditions`, `createEmptyCondition`, `createEmptyGroup`, `filterRecords`, `getFilterDepth`, `getOperatorsForColumnType`, `useFilter`
