import { describe, expect, it } from 'vitest'
import { DataTable, KanbanBoard, formatCurrency, formatDate, formatNumber, makeActionsColumn } from './index'

describe('public formatter exports', () => {
  it('exports the currency, date, and number formatters from the package root', () => {
    expect(formatCurrency).toBeTypeOf('function')
    expect(formatDate).toBeTypeOf('function')
    expect(formatNumber).toBeTypeOf('function')
  })
})

describe('row-actions exports', () => {
  it('exports makeActionsColumn from the package root', () => {
    expect(makeActionsColumn).toBeTypeOf('function')
  })
})

describe('kanban exports', () => {
  it('exports the standalone and compound kanban components', () => {
    expect(KanbanBoard).toBeTypeOf('function')
    expect(DataTable.KanbanBoard).toBe(KanbanBoard)
  })
})
