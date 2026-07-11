import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGroupBy } from './useGroupBy'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'tags', label: 'Tags', type: 'tags' },
  { id: 'name', label: 'Name', type: 'text' },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useGroupBy tags exclusion', () => {
  it('drops an unsupported tags field from default grouping', () => {
    const { result } = renderHook(() => useGroupBy({
      data: [{ tags: ['Remote'], name: 'Alice' }],
      columns,
      defaultLevels: [{ field: 'tags', sort: 'asc' }],
    }))

    expect(result.current.levels).toEqual([])
  })

  it('ignores programmatic attempts to add a tags group', () => {
    const { result } = renderHook(() => useGroupBy({
      data: [{ tags: ['Remote'], name: 'Alice' }],
      columns,
    }))

    act(() => result.current.addGroup('tags'))

    expect(result.current.levels).toEqual([])
  })

  it('ignores programmatic attempts to update a group to a tags field', () => {
    const { result } = renderHook(() => useGroupBy({
      data: [{ tags: ['Remote'], name: 'Alice' }],
      columns,
      defaultLevels: [{ field: 'name', sort: 'asc' }],
    }))

    act(() => result.current.updateGroup(0, { field: 'tags' }))

    expect(result.current.levels).toEqual([{ field: 'name', sort: 'asc' }])
  })
})

describe('useGroupBy snapshots', () => {
  it('round-trips groups, collapsed paths, and show-empty state', () => {
    const data = [{ tags: ['Remote'], name: 'Alice' }]
    const { result } = renderHook(() => useGroupBy({
      data,
      columns,
      storageKey: 'snapshot-group',
    }))
    const originalGetSnapshot = result.current.getSnapshot
    const originalRestore = result.current.restore

    act(() => result.current.addGroup('name'))
    act(() => result.current.toggleCollapse('Alice'))
    act(() => result.current.setShowEmpty(true))
    const snapshot = result.current.getSnapshot()

    act(() => result.current.clearGroups())
    act(() => result.current.setShowEmpty(false))
    act(() => result.current.restore(snapshot))

    expect(result.current.getSnapshot()).toEqual(snapshot)
    expect(JSON.parse(localStorage.getItem('snapshot-group-groupby')!)).toEqual(snapshot)
    expect(result.current.getSnapshot).toBe(originalGetSnapshot)
    expect(result.current.restore).toBe(originalRestore)
  })
})
