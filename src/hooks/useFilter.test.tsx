import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilter } from './useFilter'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { name: 'Alice', amount: 100 },
  { name: 'Bob', amount: 200 },
  { name: 'Charlie', amount: 50 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useFilter', () => {
  it('returns all data when no conditions exist', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    expect(result.current.filteredData).toEqual(data)
    expect(result.current.activeCount).toBe(0)
  })

  it('adds and removes conditions', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    expect(result.current.activeCount).toBe(1)
    const conditionId = result.current.root.conditions[0].id
    act(() => result.current.removeCondition(result.current.root.id, conditionId))
    expect(result.current.activeCount).toBe(0)
  })

  it('filters data when condition has a value', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const conditionId = result.current.root.conditions[0].id
    act(() =>
      result.current.updateCondition(result.current.root.id, conditionId, {
        operator: 'contains',
        value: 'ali',
      }),
    )
    expect(result.current.filteredData).toHaveLength(1)
    expect(result.current.filteredData[0].name).toBe('Alice')
  })

  it('toggles enabled state', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const conditionId = result.current.root.conditions[0].id
    act(() =>
      result.current.updateCondition(result.current.root.id, conditionId, {
        operator: 'contains',
        value: 'ali',
      }),
    )
    expect(result.current.filteredData).toHaveLength(1)
    act(() => result.current.setEnabled(false))
    expect(result.current.filteredData).toEqual(data)
  })

  it('adds nested groups up to MAX_DEPTH', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    act(() => result.current.addGroup(result.current.root.id))
    expect(result.current.root.groups).toHaveLength(1)
    const subGroupId = result.current.root.groups[0].id
    act(() => result.current.addGroup(subGroupId))
    expect(result.current.root.groups[0].groups).toHaveLength(1)
    const subSubGroupId = result.current.root.groups[0].groups[0].id
    act(() => result.current.addGroup(subSubGroupId))
    expect(result.current.root.groups[0].groups[0].groups).toHaveLength(0)
  })

  it('clears all conditions', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    act(() => result.current.addCondition(result.current.root.id, 'amount'))
    expect(result.current.activeCount).toBe(2)
    act(() => result.current.clearAll())
    expect(result.current.activeCount).toBe(0)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const saved = JSON.parse(localStorage.getItem('test-filters')!)
    expect(saved.root.conditions).toHaveLength(1)
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-filters', 'not valid json')
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    expect(result.current.activeCount).toBe(0)
    expect(result.current.filteredData).toEqual(data)
  })

  it('falls back to defaults when localStorage has wrong shape', () => {
    localStorage.setItem('test-filters', JSON.stringify({ root: 'not-a-group', enabled: 42 }))
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    expect(result.current.activeCount).toBe(0)
  })

  it('round-trips a snapshot and persists the restored value immediately', () => {
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'snapshot-filter' }))
    const originalGetSnapshot = result.current.getSnapshot
    const originalRestore = result.current.restore

    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const conditionId = result.current.root.conditions[0].id
    act(() => result.current.updateCondition(result.current.root.id, conditionId, {
      operator: 'contains',
      value: 'ali',
    }))
    act(() => result.current.setEnabled(false))
    const snapshot = result.current.getSnapshot()

    act(() => result.current.clearAll())
    act(() => result.current.setEnabled(true))
    act(() => result.current.restore(snapshot))

    expect(result.current.getSnapshot()).toEqual(snapshot)
    expect(JSON.parse(localStorage.getItem('snapshot-filter-filters')!)).toEqual(snapshot)
    expect(result.current.getSnapshot).toBe(originalGetSnapshot)
    expect(result.current.restore).toBe(originalRestore)
  })
})
