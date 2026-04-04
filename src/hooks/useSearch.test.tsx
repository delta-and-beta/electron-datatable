import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from './useSearch'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
]

const data = [
  { name: 'Alice', email: 'alice@test.com' },
  { name: 'Bob', email: 'bob@test.com' },
]

describe('useSearch', () => {
  it('returns all data when query is empty', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    expect(result.current.filteredData).toEqual(data)
  })

  it('filters data when query is set', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    act(() => result.current.setQuery('alice'))
    expect(result.current.filteredData).toHaveLength(1)
    expect(result.current.filteredData[0].name).toBe('Alice')
  })

  it('clears search', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    act(() => result.current.setQuery('alice'))
    expect(result.current.filteredData).toHaveLength(1)
    act(() => result.current.clearSearch())
    expect(result.current.filteredData).toEqual(data)
  })

  it('query state is readable', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    expect(result.current.query).toBe('')
    act(() => result.current.setQuery('test'))
    expect(result.current.query).toBe('test')
  })
})
