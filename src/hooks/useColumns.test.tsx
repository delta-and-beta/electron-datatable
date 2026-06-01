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
})
