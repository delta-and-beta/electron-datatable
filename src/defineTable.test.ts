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
})
