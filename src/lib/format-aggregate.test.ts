import { describe, it, expect } from 'vitest'
import { formatAggregateValue } from './format-aggregate'
import type { ColumnDef } from '../types'

describe('formatAggregateValue', () => {
  it('uses column.format when provided', () => {
    const col: ColumnDef = {
      id: 'x',
      label: 'X',
      type: 'number',
      format: (v) => `custom:${v}`,
    }
    expect(formatAggregateValue(col, 42)).toBe('custom:42')
  })

  it('formats currency columns with Intl', () => {
    const col: ColumnDef = {
      id: 'amt',
      label: 'Amount',
      type: 'currency',
      currency: 'HKD',
    }
    const result = formatAggregateValue(col, 1234.5)
    expect(result).toMatch(/HKD|HK\$/)
    expect(result).toContain('1,234.50')
  })

  it('formats currency columns defaulting to USD', () => {
    const col: ColumnDef = {
      id: 'amt',
      label: 'Amount',
      type: 'currency',
    }
    const result = formatAggregateValue(col, 99)
    // Should use USD by default (the $ sign or "USD")
    expect(result).toMatch(/\$|USD/)
  })

  it('formats minor-units currency sums without double division', () => {
    const col: ColumnDef = {
      id: 'amt',
      label: 'Amount',
      type: 'currency',
      minorUnits: true,
      symbol: 'HK$',
    }

    expect(formatAggregateValue(col, 150000)).toBe('HK$1,500.00')
  })

  it('formats number columns', () => {
    const col: ColumnDef = {
      id: 'qty',
      label: 'Quantity',
      type: 'number',
    }
    expect(formatAggregateValue(col, 1234)).toBe('1,234')
  })

  it('returns empty string for non-aggregatable types', () => {
    const col: ColumnDef = { id: 't', label: 'T', type: 'text' }
    expect(formatAggregateValue(col, 0)).toBe('')
  })
})
