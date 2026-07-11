import { describe, expect, it, vi } from 'vitest'
import { defineTable } from './defineTable'

interface Person {
  id: string
  name: string
}

describe('defineTable row actions', () => {
  it('preserves actions in the spreadable table definition', () => {
    const actions = [
      { key: 'edit', title: 'Edit person', onClick: vi.fn<(row: Person) => void>() },
    ]

    const table = defineTable<Person>({
      rowKey: 'id',
      columns: {
        name: { label: 'Name', type: 'text' },
      },
      actions,
    })

    expect(table.actions).toBe(actions)
  })

  it('preserves the frozen column count in the spreadable table definition', () => {
    const table = defineTable<Person>({
      rowKey: 'id',
      frozenColumns: 1,
      columns: {
        name: { label: 'Name', type: 'text' },
      },
    })

    expect(table.frozenColumns).toBe(1)
  })

  it('preserves kanban configuration in the spreadable table definition', () => {
    const onMove = vi.fn()
    const kanban = {
      laneField: 'name',
      laneOrder: ['Alice', 'Bob'],
      card: { titleField: 'name' },
      allowMove: true,
      onMove,
    }

    const table = defineTable<Person>({
      rowKey: 'id',
      columns: {
        name: { label: 'Name', type: 'text' },
      },
      kanban,
    })

    expect(table.kanban).toBe(kanban)
  })

  it('preserves view mode control in the spreadable table definition', () => {
    const onViewModeChange = vi.fn()

    const table = defineTable<Person>({
      rowKey: 'id',
      columns: {
        name: { label: 'Name', type: 'text' },
      },
      viewMode: 'kanban',
      onViewModeChange,
    })

    expect(table.viewMode).toBe('kanban')
    expect(table.onViewModeChange).toBe(onViewModeChange)
  })
})
