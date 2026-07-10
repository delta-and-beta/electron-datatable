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
