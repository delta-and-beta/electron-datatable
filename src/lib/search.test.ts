import { describe, it, expect } from 'vitest'
import { searchRecords } from './search'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'date', label: 'Date', type: 'date' },
]

const data = [
  { name: 'Alice', email: 'alice@example.com', amount: 100, date: '2024-01-01' },
  { name: 'Bob', email: 'bob@test.com', amount: 200, date: '2024-06-01' },
  { name: 'Charlie', email: 'charlie@example.com', amount: 50, date: '2024-03-01' },
]

describe('searchRecords', () => {
  it('returns all records for empty query', () => {
    expect(searchRecords(data, '', columns)).toEqual(data)
    expect(searchRecords(data, '   ', columns)).toEqual(data)
  })

  it('searches text columns by default', () => {
    const result = searchRecords(data, 'alice', columns)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('is case insensitive', () => {
    const result = searchRecords(data, 'ALICE', columns)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('does not search non-text columns by default', () => {
    const result = searchRecords(data, '100', columns)
    expect(result).toHaveLength(0)
  })

  it('respects searchable: true on non-text columns', () => {
    const searchableAmount: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'amount', label: 'Amount', type: 'number', searchable: true },
    ]
    const result = searchRecords(data, '100', searchableAmount)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('respects searchable: false on text columns', () => {
    const noSearchName: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', searchable: false },
      { id: 'email', label: 'Email', type: 'text' },
    ]
    const result = searchRecords(data, 'Alice', noSearchName)
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('alice@example.com')
  })

  it('returns all records when all columns are non-searchable', () => {
    const allNonSearchable: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', searchable: false },
      { id: 'amount', label: 'Amount', type: 'number', searchable: false },
    ]
    const result = searchRecords(data, 'Alice', allNonSearchable)
    expect(result).toHaveLength(3)
  })

  it('handles null/undefined values in records', () => {
    const withNulls = [
      { name: null, email: 'test@test.com', amount: 0, date: '' },
      { name: 'Alice', email: null, amount: 100, date: '2024-01-01' },
    ]
    const result = searchRecords(withNulls, 'test', columns)
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('test@test.com')
  })
})
