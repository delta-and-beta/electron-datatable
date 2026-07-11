import { act, renderHook, waitFor } from '@testing-library/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyGroup } from '../lib/filter'
import type { DataTableView } from '../types'
import { useViews } from './useViews'

function useFacet<T>(initial: T) {
  const [value, setValue] = useState(initial)
  const valueRef = useRef(value)
  valueRef.current = value
  const getSnapshot = useCallback(() => valueRef.current, [])
  const restore = useCallback((snapshot: T) => {
    valueRef.current = snapshot
    setValue(snapshot)
  }, [])
  const facet = useMemo(() => ({ getSnapshot, restore }), [getSnapshot, restore])
  return { value, setValue, facet }
}

const emptyFilter = { root: createEmptyGroup(), enabled: true }

function useViewsHarness(
  storageKey = 'views-test',
  initialSort: DataTableView['sort'] = [],
) {
  const columns = useFacet<DataTableView['columns']>({
    visible: ['name', 'amount'],
    order: ['name', 'amount'],
    widths: {},
    frozen: 0,
  })
  const sort = useFacet<DataTableView['sort']>(initialSort)
  const filter = useFacet<DataTableView['filter']>(emptyFilter)
  const groupBy = useFacet<DataTableView['groupBy']>({ groups: [], collapsed: [], showEmpty: false })
  const viewMode = useFacet<'table' | 'kanban'>('table')
  const views = useViews({
    storageKey,
    columns: columns.facet,
    sort: sort.facet,
    filter: filter.facet,
    groupBy: groupBy.facet,
    viewMode: viewMode.facet,
  })
  return { columns, sort, filter, groupBy, viewMode, views }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useViews', () => {
  it('saves and switches every view facet together', () => {
    const { result } = renderHook(() => useViewsHarness())

    let baselineId = ''
    act(() => {
      baselineId = result.current.views.saveAs('Baseline').id
    })

    const nextFilter = {
      root: {
        ...emptyFilter.root,
        conditions: [{
          id: 'condition-1',
          field: 'name',
          operator: 'contains' as const,
          value: 'ali',
        }],
      },
      enabled: false,
    }
    act(() => {
      result.current.columns.setValue({
        visible: ['amount'],
        order: ['amount', 'name'],
        widths: { amount: 220 },
        frozen: 1,
      })
      result.current.sort.setValue([{ field: 'amount', direction: 'desc' }])
      result.current.filter.setValue(nextFilter)
      result.current.groupBy.setValue({
        groups: [{ field: 'name', sort: 'asc' }],
        collapsed: ['Alice'],
        showEmpty: true,
      })
      result.current.viewMode.setValue('kanban')
      result.current.views.setRowHeight('tall')
    })

    let alternateId = ''
    act(() => {
      alternateId = result.current.views.saveAs('Alternate').id
      result.current.views.switchTo(baselineId)
    })
    expect(result.current.columns.value).toEqual({
      visible: ['name', 'amount'],
      order: ['name', 'amount'],
      widths: {},
      frozen: 0,
    })
    expect(result.current.sort.value).toEqual([])
    expect(result.current.filter.value).toEqual(emptyFilter)
    expect(result.current.groupBy.value).toEqual({ groups: [], collapsed: [], showEmpty: false })
    expect(result.current.viewMode.value).toBe('table')
    expect(result.current.views.rowHeight).toBe('medium')

    act(() => result.current.views.switchTo(alternateId))
    expect(result.current.columns.value).toMatchObject({ widths: { amount: 220 }, frozen: 1 })
    expect(result.current.sort.value).toEqual([{ field: 'amount', direction: 'desc' }])
    expect(result.current.filter.value).toEqual(nextFilter)
    expect(result.current.groupBy.value).toMatchObject({ collapsed: ['Alice'], showEmpty: true })
    expect(result.current.viewMode.value).toBe('kanban')
    expect(result.current.views.rowHeight).toBe('tall')
  })

  it('migrates legacy facet keys into an active Default view without losing values', () => {
    const legacyColumns = {
      visible: ['amount'],
      order: ['amount', 'name'],
      widths: { amount: 240 },
      frozen: 1,
    }
    const legacySort = [{ field: 'amount', direction: 'desc' as const }]
    const legacyFilter = {
      root: {
        ...emptyFilter.root,
        conditions: [{ id: 'legacy-filter', field: 'name', operator: 'contains' as const, value: 'A' }],
      },
      enabled: false,
    }
    const legacyGroupBy = {
      groups: [{ field: 'name', sort: 'asc' as const }],
      collapsed: ['Alice'],
      showEmpty: true,
    }
    localStorage.setItem('legacy-columns', JSON.stringify(legacyColumns))
    localStorage.setItem('legacy-sort', JSON.stringify(legacySort))
    localStorage.setItem('legacy-filters', JSON.stringify(legacyFilter))
    localStorage.setItem('legacy-groupby', JSON.stringify(legacyGroupBy))

    const { result } = renderHook(() => useViewsHarness('legacy'))

    expect(result.current.views.views).toHaveLength(1)
    expect(result.current.views.views[0]).toMatchObject({
      name: 'Default',
      columns: legacyColumns,
      sort: legacySort,
      filter: legacyFilter,
      groupBy: legacyGroupBy,
      rowHeight: 'medium',
    })
    expect(result.current.views.activeViewId).toBe(result.current.views.views[0].id)
    expect(JSON.parse(localStorage.getItem('legacy-views')!)).toEqual(result.current.views.views)
    expect(localStorage.getItem('legacy-active-view')).toBe(result.current.views.views[0].id)
  })

  it('marks a changed active view dirty and clears the flag after update', () => {
    const { result } = renderHook(() => useViewsHarness())
    let viewId = ''
    act(() => {
      viewId = result.current.views.saveAs('Working')!.id
    })
    expect(result.current.views.isDirty).toBe(false)

    act(() => result.current.sort.setValue([{ field: 'name', direction: 'asc' }]))
    expect(result.current.views.isDirty).toBe(true)

    act(() => result.current.views.update(viewId))
    expect(result.current.views.isDirty).toBe(false)
  })

  it('renames, duplicates, removes, and sets the mount default', () => {
    const { result } = renderHook(() => useViewsHarness())
    let originalId = ''
    let duplicateId = ''
    act(() => {
      originalId = result.current.views.saveAs('Original').id
      result.current.views.rename(originalId, 'Renamed')
      duplicateId = result.current.views.duplicate(originalId).id
      result.current.views.setDefault(duplicateId)
    })

    expect(result.current.views.views.map((view) => view.name)).toEqual(['Renamed', 'Renamed copy'])
    expect(result.current.views.defaultViewId).toBe(duplicateId)
    expect(localStorage.getItem('views-test-active-view')).toBe(duplicateId)

    act(() => result.current.views.remove(originalId))
    expect(result.current.views.views.map((view) => view.id)).toEqual([duplicateId])
  })

  it('auto-applies the default view on mount', async () => {
    const defaultView: DataTableView = {
      id: 'default-view',
      name: 'Default',
      viewMode: 'kanban',
      sort: [{ field: 'amount', direction: 'desc' }],
      filter: emptyFilter,
      groupBy: { groups: [{ field: 'name', sort: 'asc' }], collapsed: [], showEmpty: false },
      columns: { visible: ['amount'], order: ['amount', 'name'], widths: {}, frozen: 1 },
      rowHeight: 'short',
    }
    localStorage.setItem('mount-views', JSON.stringify([defaultView]))
    localStorage.setItem('mount-active-view', defaultView.id)

    const { result } = renderHook(() => useViewsHarness('mount'))

    await waitFor(() => {
      expect(result.current.sort.value).toEqual(defaultView.sort)
      expect(result.current.columns.value).toEqual(defaultView.columns)
      expect(result.current.groupBy.value).toEqual(defaultView.groupBy)
      expect(result.current.viewMode.value).toBe('kanban')
      expect(result.current.views.rowHeight).toBe('short')
    })
  })

  it('persists the active saved view and reloads every saved facet without dirtiness', async () => {
    const first = renderHook(() => useViewsHarness('saved-reload'))
    const savedFilter = {
      root: {
        ...emptyFilter.root,
        conditions: [{
          id: 'saved-condition',
          field: 'name',
          operator: 'contains' as const,
          value: 'saved',
        }],
      },
      enabled: false,
    }
    let savedId = ''

    act(() => {
      first.result.current.columns.setValue({
        visible: ['amount'],
        order: ['amount', 'name'],
        widths: { amount: 210 },
        frozen: 1,
      })
      first.result.current.sort.setValue([{ field: 'amount', direction: 'desc' }])
      first.result.current.filter.setValue(savedFilter)
      first.result.current.groupBy.setValue({
        groups: [{ field: 'name', sort: 'asc' }],
        collapsed: ['Alice'],
        showEmpty: true,
      })
      first.result.current.viewMode.setValue('kanban')
      first.result.current.views.setRowHeight('tall')
    })
    act(() => {
      savedId = first.result.current.views.saveAs('Saved').id
    })

    expect(localStorage.getItem('saved-reload-active-view')).toBe(savedId)
    first.unmount()

    const second = renderHook(() => useViewsHarness('saved-reload'))
    await waitFor(() => {
      expect(second.result.current.views.activeViewId).toBe(savedId)
      expect(second.result.current.columns.value).toEqual({
        visible: ['amount'],
        order: ['amount', 'name'],
        widths: { amount: 210 },
        frozen: 1,
      })
      expect(second.result.current.sort.value).toEqual([{ field: 'amount', direction: 'desc' }])
      expect(second.result.current.filter.value).toEqual(savedFilter)
      expect(second.result.current.groupBy.value).toEqual({
        groups: [{ field: 'name', sort: 'asc' }],
        collapsed: ['Alice'],
        showEmpty: true,
      })
      expect(second.result.current.viewMode.value).toBe('kanban')
      expect(second.result.current.views.rowHeight).toBe('tall')
      expect(second.result.current.views.isDirty).toBe(false)
    })
  })

  it('reloads unsaved working facets over the active view and marks it dirty', async () => {
    const first = renderHook(() => useViewsHarness('dirty-reload'))
    let savedId = ''
    act(() => {
      first.result.current.viewMode.setValue('kanban')
      first.result.current.views.setRowHeight('short')
    })
    act(() => {
      savedId = first.result.current.views.saveAs('Baseline').id
    })
    act(() => {
      first.result.current.sort.setValue([{ field: 'name', direction: 'desc' }])
    })
    localStorage.setItem('dirty-reload-sort', JSON.stringify([{ field: 'name', direction: 'desc' }]))
    first.unmount()

    const second = renderHook(() => useViewsHarness(
      'dirty-reload',
      [{ field: 'name', direction: 'desc' }],
    ))
    await waitFor(() => {
      expect(second.result.current.views.activeViewId).toBe(savedId)
      expect(second.result.current.sort.value).toEqual([{ field: 'name', direction: 'desc' }])
      expect(second.result.current.viewMode.value).toBe('kanban')
      expect(second.result.current.views.rowHeight).toBe('short')
      expect(second.result.current.views.isDirty).toBe(true)
    })
  })

  it('persists the active view on every switch', () => {
    const { result } = renderHook(() => useViewsHarness('switch-active'))
    let firstId = ''
    let secondId = ''
    act(() => {
      firstId = result.current.views.saveAs('First').id
      secondId = result.current.views.saveAs('Second').id
    })

    act(() => result.current.views.switchTo(firstId))

    expect(result.current.views.activeViewId).toBe(firstId)
    expect(localStorage.getItem('switch-active-active-view')).toBe(firstId)
    expect(secondId).not.toBe(firstId)
  })

  it.each([
    ['null', null],
    ['array', []],
  ])('migrates a malformed legacy group-by %s payload without throwing', (_label, payload) => {
    localStorage.setItem('malformed-groupby', JSON.stringify(payload))

    const { result } = renderHook(() => useViewsHarness('malformed'))

    expect(result.current.views.views).toHaveLength(1)
    expect(result.current.views.views[0].groupBy).toEqual({
      groups: [],
      collapsed: [],
      showEmpty: false,
    })
  })
})
