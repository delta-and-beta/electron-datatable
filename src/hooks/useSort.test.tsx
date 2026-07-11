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
    expect(saved).toEqual([{ field: 'name', direction: 'asc' }])
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

  it('supports multi-field sort via setSortLevels (tiebreakers)', () => {
    const rows = [
      { team: 'B', score: 1 },
      { team: 'A', score: 2 },
      { team: 'A', score: 1 },
      { team: 'B', score: 2 },
    ]
    const { result } = renderHook(() => useSort({ data: rows }))
    act(() =>
      result.current.setSortLevels([
        { field: 'team', direction: 'asc' },
        { field: 'score', direction: 'desc' },
      ]),
    )
    expect(result.current.sortLevels).toHaveLength(2)
    expect(result.current.sortedData).toEqual([
      { team: 'A', score: 2 },
      { team: 'A', score: 1 },
      { team: 'B', score: 2 },
      { team: 'B', score: 1 },
    ])
    // Backward-compatible primary view
    expect(result.current.sortField).toBe('team')
    expect(result.current.sortDirection).toBe('asc')
  })

  it('migrates a legacy single-object localStorage value into one level', () => {
    localStorage.setItem('mig-sort', JSON.stringify({ field: 'age', direction: 'desc' }))
    const { result } = renderHook(() => useSort({ data, storageKey: 'mig' }))
    expect(result.current.sortLevels).toEqual([{ field: 'age', direction: 'desc' }])
  })

  it('round-trips a snapshot and persists the restored value immediately', () => {
    const { result } = renderHook(() => useSort({ data, storageKey: 'snapshot-sort' }))
    const originalGetSnapshot = result.current.getSnapshot
    const originalRestore = result.current.restore

    act(() => result.current.setSortLevels([
      { field: 'name', direction: 'asc' },
      { field: 'age', direction: 'desc' },
    ]))
    const snapshot = result.current.getSnapshot()
    act(() => result.current.setSort('age', 'asc'))
    act(() => result.current.restore(snapshot))

    expect(result.current.getSnapshot()).toEqual(snapshot)
    expect(JSON.parse(localStorage.getItem('snapshot-sort-sort')!)).toEqual(snapshot)
    expect(result.current.getSnapshot).toBe(originalGetSnapshot)
    expect(result.current.restore).toBe(originalRestore)
  })
})
