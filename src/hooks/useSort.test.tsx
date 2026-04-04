import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from './useSort'

const data = [
  { name: 'Charlie', age: 30 },
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 35 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useSort', () => {
  it('returns unsorted data when no field is set', () => {
    const { result } = renderHook(() => useSort({ data }))
    expect(result.current.sortedData).toEqual(data)
    expect(result.current.sortField).toBeNull()
  })

  it('sorts by default field on mount', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'asc' }),
    )
    expect(result.current.sortedData.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('toggles direction when clicking same field', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'asc' }),
    )
    act(() => result.current.setSort('name'))
    expect(result.current.sortDirection).toBe('desc')
    act(() => result.current.setSort('name'))
    expect(result.current.sortDirection).toBe('asc')
  })

  it('resets to asc when clicking a new field', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'desc' }),
    )
    act(() => result.current.setSort('age'))
    expect(result.current.sortField).toBe('age')
    expect(result.current.sortDirection).toBe('asc')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() =>
      useSort({ data, storageKey: 'test' }),
    )
    act(() => result.current.setSort('name'))
    const saved = JSON.parse(localStorage.getItem('test-sort')!)
    expect(saved).toEqual({ field: 'name', direction: 'asc' })
  })

  it('restores from localStorage', () => {
    localStorage.setItem('test-sort', JSON.stringify({ field: 'age', direction: 'desc' }))
    const { result } = renderHook(() =>
      useSort({ data, storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('age')
    expect(result.current.sortDirection).toBe('desc')
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-sort', 'not valid json')
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('name')
  })

  it('falls back to defaults when localStorage has wrong shape', () => {
    localStorage.setItem('test-sort', JSON.stringify({ field: 123, direction: 'invalid' }))
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('name')
  })
})
