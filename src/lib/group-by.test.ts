import { describe, it, expect } from 'vitest'
import { groupRecords, getGroupKey, getDatePeriodKey, sortGroups } from './group-by'
import { resolveOrdinalOrder } from './ordinal-vocabularies'

describe('getGroupKey', () => {
  it('returns string representation of value', () => {
    expect(getGroupKey('hello')).toBe('hello')
    expect(getGroupKey(42)).toBe('42')
  })

  it('returns (Empty) for null/undefined/empty string', () => {
    expect(getGroupKey(null)).toBe('(Empty)')
    expect(getGroupKey(undefined)).toBe('(Empty)')
    expect(getGroupKey('')).toBe('(Empty)')
  })
})

describe('getDatePeriodKey', () => {
  it('buckets by month', () => {
    expect(getDatePeriodKey('2024-03-15', 'month')).toBe('2024-03')
  })

  it('buckets by quarter', () => {
    expect(getDatePeriodKey('2024-03-15', 'quarter')).toBe('2024 Q1')
    expect(getDatePeriodKey('2024-07-01', 'quarter')).toBe('2024 Q3')
  })

  it('buckets by year', () => {
    expect(getDatePeriodKey('2024-03-15', 'year')).toBe('2024')
  })

  it('buckets by day', () => {
    expect(getDatePeriodKey('2024-03-15', 'day')).toBe('2024-03-15')
  })

  it('returns (Invalid Date) for bad input', () => {
    expect(getDatePeriodKey('not-a-date', 'month')).toBe('(Invalid Date)')
  })
})

describe('sortGroups', () => {
  it('sorts ascending with (Empty) at end', () => {
    expect(sortGroups(['B', '(Empty)', 'A', 'C'], 'asc')).toEqual(['A', 'B', 'C', '(Empty)'])
  })

  it('sorts descending with (Empty) at end', () => {
    expect(sortGroups(['B', '(Empty)', 'A', 'C'], 'desc')).toEqual(['C', 'B', 'A', '(Empty)'])
  })

  it('orders a recognized vocabulary (High/Medium/Low) instead of alphabetically', () => {
    expect(sortGroups(['Low', 'High', 'Medium'], 'asc')).toEqual(['High', 'Medium', 'Low'])
  })

  it('reverses an ordinal vocabulary on desc', () => {
    expect(sortGroups(['Low', 'High', 'Medium'], 'desc')).toEqual(['Low', 'Medium', 'High'])
  })

  it('orders a subset of a vocabulary and keeps (Empty) last', () => {
    expect(sortGroups(['Low', '(Empty)', 'High'], 'asc')).toEqual(['High', 'Low', '(Empty)'])
  })

  it('orders the sales funnel', () => {
    expect(sortGroups(['Realized', 'Pipeline', 'Committed'], 'asc')).toEqual(['Pipeline', 'Committed', 'Realized'])
  })

  it('falls back to alphabetical for unrecognized values', () => {
    expect(sortGroups(['Banana', 'Apple', 'Cherry'], 'asc')).toEqual(['Apple', 'Banana', 'Cherry'])
  })
})

describe('resolveOrdinalOrder', () => {
  it('returns canonical order when all keys belong to one vocabulary', () => {
    expect(resolveOrdinalOrder(['Low', 'High', 'Medium'])).toEqual(['High', 'Medium', 'Low'])
  })

  it('is case- and whitespace-insensitive but preserves original strings', () => {
    expect(resolveOrdinalOrder(['low ', 'HIGH'])).toEqual(['HIGH', 'low '])
  })

  it('returns null when keys are not all in a vocabulary', () => {
    expect(resolveOrdinalOrder(['High', 'Banana'])).toBeNull()
  })

  it('returns null for fewer than two keys', () => {
    expect(resolveOrdinalOrder(['High'])).toBeNull()
  })
})

describe('groupRecords', () => {
  const columns = [
    { id: 'category', label: 'Category' },
    { id: 'amount', label: 'Amount' },
    { id: 'date', label: 'Date' },
  ]

  const data = [
    { id: '1', category: 'Food', amount: 10, date: '2024-01-15' },
    { id: '2', category: 'Food', amount: 20, date: '2024-01-20' },
    { id: '3', category: 'Transport', amount: 15, date: '2024-02-10' },
    { id: '4', category: 'Food', amount: 5, date: '2024-02-15' },
  ]

  it('groups by a text field', () => {
    const result = groupRecords(
      data,
      [{ field: 'category', sort: 'asc' }],
      columns,
      ['amount'],
    )

    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('Food')
    expect(result[0].count).toBe(3)
    expect(result[0].sums.amount).toBe(35)
    expect(result[1].key).toBe('Transport')
    expect(result[1].count).toBe(1)
    expect(result[1].sums.amount).toBe(15)
  })

  it('groups by date period', () => {
    const result = groupRecords(
      data,
      [{ field: 'date', sort: 'asc', datePeriod: 'month' }],
      columns,
      ['amount'],
    )

    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('2024-01')
    expect(result[0].count).toBe(2)
    expect(result[1].key).toBe('2024-02')
    expect(result[1].count).toBe(2)
  })

  it('supports multi-level grouping', () => {
    const result = groupRecords(
      data,
      [
        { field: 'date', sort: 'asc', datePeriod: 'month' },
        { field: 'category', sort: 'asc' },
      ],
      columns,
      ['amount'],
    )

    expect(result).toHaveLength(2)
    // January has only Food
    expect(result[0].subgroups).toHaveLength(1)
    expect(result[0].subgroups[0].key).toBe('Food')
    // February has Food and Transport
    expect(result[1].subgroups).toHaveLength(2)
  })

  it('returns empty array when no levels provided', () => {
    expect(groupRecords(data, [], columns)).toEqual([])
  })
})
