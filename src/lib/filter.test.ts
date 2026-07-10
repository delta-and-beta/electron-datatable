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
  { id: 'tags', label: 'Tags', type: 'tags' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100, date: '2024-01-15', price: 50, tags: ['remote', 'vip'] },
  { id: '2', name: 'Bob', amount: 200, date: '2024-03-20', price: 75, tags: ['finance'] },
  { id: '3', name: 'Charlie', amount: 50, date: '2024-06-10', price: 100, tags: [] },
  { id: '4', name: '', amount: 0, date: '', price: 0, tags: ['remote'] },
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

  it('returns multi-value and emptiness operators for tags type', () => {
    expect(getOperatorsForColumnType('tags')).toEqual([
      'contains_any',
      'contains_all',
      'is_empty',
      'is_not_empty',
    ])
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
    expect(result.map((r) => r.id)).toEqual(['2', '3', '4'])
  })

  it('gt — greater than', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gt', value: '75' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('lt — less than', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'lt', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['3', '4'])
  })

  it('gte — greater than or equal', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gte', value: '100' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('lte — less than or equal', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'lte', value: '50' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['3', '4'])
  })

  it('is_empty — matches null values in number fields', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'is_empty', value: '' }])
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['5'])
  })

  it('skips records with null when comparing numbers', () => {
    const group = makeGroup([{ id: '1', field: 'amount', operator: 'gt', value: '0' }])
    const result = filterRecords(data, group, columns)
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

describe('filterRecords — tags operators', () => {
  function makeGroup(operator: 'contains_any' | 'contains_all' | 'is_empty' | 'is_not_empty', value: string[] = []): FilterGroup {
    return {
      ...createEmptyGroup(),
      conditions: [{ id: '1', field: 'tags', operator, value }],
    }
  }

  it('contains_any matches a row with at least one selected tag', () => {
    const result = filterRecords(data, makeGroup('contains_any', ['vip', 'finance']), columns)
    expect(result.map((row) => row.id)).toEqual(['1', '2'])
  })

  it('contains_all matches only rows containing every selected tag', () => {
    const result = filterRecords(data, makeGroup('contains_all', ['remote', 'vip']), columns)
    expect(result.map((row) => row.id)).toEqual(['1'])
  })

  it('is_empty matches empty arrays and undefined fields', () => {
    const result = filterRecords(data, makeGroup('is_empty'), columns)
    expect(result.map((row) => row.id)).toEqual(['3', '5'])
  })

  it('is_not_empty excludes empty arrays and undefined fields', () => {
    const result = filterRecords(data, makeGroup('is_not_empty'), columns)
    expect(result.map((row) => row.id)).toEqual(['1', '2', '4'])
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
    expect(result.map((r) => r.id)).toEqual(['3'])
  })

  it('nested groups — OR with AND subgroup', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'or',
      conditions: [
        { id: '1', field: 'name', operator: 'is', value: 'Alice' },
      ],
      groups: [{
        ...createEmptyGroup(),
        conjunction: 'and',
        conditions: [
          { id: '2', field: 'name', operator: 'contains', value: 'b' },
          { id: '3', field: 'amount', operator: 'gt', value: '100' },
        ],
      }],
    }
    // Alice matches root condition; Bob matches both sub-conditions (contains 'b' AND amount>100)
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('AND with mixed text and date conditions', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'and',
      conditions: [
        { id: '1', field: 'name', operator: 'contains', value: 'li' },
        { id: '2', field: 'date', operator: 'is', value: '2024-01-15' },
      ],
    }
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('empty value condition is skipped (treated as incomplete)', () => {
    const group: FilterGroup = {
      ...createEmptyGroup(),
      conjunction: 'and',
      conditions: [
        { id: '1', field: 'name', operator: 'contains', value: 'ali' },
        { id: '2', field: 'date', operator: 'is', value: '' },
      ],
    }
    // The empty date condition should be skipped, not reject everything
    const result = filterRecords(data, group, columns)
    expect(result.map((r) => r.id)).toEqual(['1', '5'])
  })

  it('returns all records when no conditions exist', () => {
    const group = createEmptyGroup()
    const result = filterRecords(data, group, columns)
    expect(result).toHaveLength(data.length)
  })
})
