import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useColumns } from './useColumns'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'age', label: 'Age', type: 'number' },
  { id: 'hidden', label: 'Hidden', type: 'text', visible: false },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useColumns', () => {
  it('defaults all columns to visible except visible: false', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    expect(result.current.visibleColumns).toEqual(['name', 'email', 'age'])
    expect(result.current.isVisible('hidden')).toBe(false)
  })

  it('toggles column visibility', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    act(() => result.current.setColumnVisibility('email', false))
    expect(result.current.visibleColumns).toEqual(['name', 'age'])
    act(() => result.current.setColumnVisibility('email', true))
    expect(result.current.visibleColumns).toContain('email')
  })

  it('reorders columns', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    act(() => result.current.reorderColumns(0, 2))
    expect(result.current.allColumns[0]).toBe('email')
    expect(result.current.allColumns[2]).toBe('name')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    act(() => result.current.setColumnVisibility('email', false))
    const saved = JSON.parse(localStorage.getItem('test-columns')!)
    expect(saved.visible).not.toContain('email')
  })

  it('sets and persists column width', () => {
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    act(() => result.current.setColumnWidth('name', 240))
    expect(result.current.widths.name).toBe(240)
    const saved = JSON.parse(localStorage.getItem('test-columns')!)
    expect(saved.widths.name).toBe(240)
  })

  it('persists and restores the frozen column count', () => {
    const first = renderHook(() => useColumns({
      columns,
      storageKey: 'frozen-round-trip',
      frozenColumns: 2,
    }))

    expect(first.result.current.frozenColumns).toBe(2)
    expect(JSON.parse(localStorage.getItem('frozen-round-trip-columns')!).frozen).toBe(2)

    act(() => first.result.current.setFrozenColumns(1))
    first.unmount()

    const second = renderHook(() => useColumns({
      columns,
      storageKey: 'frozen-round-trip',
      frozenColumns: 2,
    }))
    expect(second.result.current.frozenColumns).toBe(1)
  })

  it('loads a legacy column payload without frozen and falls back to the prop', () => {
    localStorage.setItem('legacy-columns', JSON.stringify({
      visible: ['name', 'email', 'age'],
      order: ['name', 'email', 'age', 'hidden'],
      widths: { name: 240 },
    }))

    const { result } = renderHook(() => useColumns({
      columns,
      storageKey: 'legacy',
      frozenColumns: 2,
    }))

    expect(result.current.visibleColumns).toEqual(['name', 'email', 'age'])
    expect(result.current.widths.name).toBe(240)
    expect(result.current.frozenColumns).toBe(2)
  })

  it('restores from localStorage', () => {
    localStorage.setItem('test-columns', JSON.stringify({
      visible: ['name', 'age'],
      order: ['age', 'name', 'email', 'hidden'],
    }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).toEqual(['age', 'name'])
  })

  it('prunes removed columns from saved state', () => {
    localStorage.setItem('test-columns', JSON.stringify({
      visible: ['name', 'deleted_col'],
      order: ['name', 'deleted_col', 'email'],
    }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).not.toContain('deleted_col')
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-columns', JSON.stringify({ visible: 'not-an-array' }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).toEqual(['name', 'email', 'age'])
  })

  it('round-trips a snapshot and persists the restored value immediately', () => {
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'snapshot-columns' }))
    const originalGetSnapshot = result.current.getSnapshot
    const originalRestore = result.current.restore

    act(() => {
      result.current.setColumnVisibility('email', false)
      result.current.reorderColumns(0, 2)
      result.current.setColumnWidth('name', 240)
      result.current.setFrozenColumns(2)
    })
    const snapshot = result.current.getSnapshot()

    act(() => result.current.setColumnVisibility('email', true))
    act(() => result.current.restore(snapshot))

    expect(result.current.getSnapshot()).toEqual(snapshot)
    expect(JSON.parse(localStorage.getItem('snapshot-columns-columns')!)).toEqual(snapshot)
    expect(result.current.getSnapshot).toBe(originalGetSnapshot)
    expect(result.current.restore).toBe(originalRestore)
  })
})
