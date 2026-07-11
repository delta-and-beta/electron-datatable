import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DataTable } from './DataTable'
import { KanbanBoard } from './KanbanBoard'
import type { ColumnDef, KanbanConfig } from '../types'

interface Deal {
  id: string
  stage: string | null
  title: string
  company: string
  value: number
  confidence: string
}

const columns: ColumnDef<Deal>[] = [
  {
    id: 'stage',
    label: 'Stage',
    type: 'text',
    options: ['New', { value: 'Won', label: 'Closed won' }],
  },
  { id: 'title', label: 'Title', type: 'text' },
  { id: 'company', label: 'Company', type: 'text' },
  {
    id: 'value',
    label: 'Value',
    type: 'currency',
    currency: 'HKD',
    minorUnits: true,
    symbol: 'HK$',
  },
  {
    id: 'confidence',
    label: 'Confidence',
    type: 'custom',
    badgeVariants: { High: 'success' },
  },
]

const deals: Deal[] = [
  { id: '1', stage: 'New', title: 'Alpha', company: 'Acme', value: 12345, confidence: 'High' },
  { id: '2', stage: 'Legacy', title: 'Beta', company: 'Beta Ltd', value: 5000, confidence: 'Low' },
  { id: '3', stage: null, title: 'Gamma', company: 'Gamma Ltd', value: 2500, confidence: 'High' },
]

function createKanban(overrides: Partial<KanbanConfig<Deal>> = {}): KanbanConfig<Deal> {
  return {
    laneOrder: ['New', 'Won'],
    card: {
      titleField: 'title',
      subtitleField: 'company',
      footerFields: ['value', 'confidence'],
    },
    laneAggregate: { field: 'value', label: 'Total' },
    ...overrides,
  }
}

function renderBoard({
  data = deals,
  kanban = createKanban(),
  onRowClick,
}: {
  data?: Deal[]
  kanban?: KanbanConfig<Deal>
  onRowClick?: (row: Deal) => void
} = {}) {
  return render(
    <DataTable
      data={data}
      columns={columns}
      rowKey="id"
      storageKey="kanban-board-test"
      defaultGroupBy={[{ field: 'stage', sort: 'asc' }]}
      kanban={kanban}
      onRowClick={onRowClick}
    >
      <KanbanBoard<Deal> />
    </DataTable>,
  )
}

function dataTransfer() {
  let value = ''
  return {
    setData: vi.fn((_type: string, next: string) => { value = next }),
    getData: vi.fn(() => value),
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('KanbanBoard', () => {
  it('renders ordered lanes including empty lanes and trails unknown rows in Uncategorized', () => {
    renderBoard()

    const newLane = screen.getByRole('region', { name: 'New lane' })
    const wonLane = screen.getByRole('region', { name: 'Closed won lane' })
    const uncategorized = screen.getByRole('region', { name: 'Uncategorized lane' })

    expect(within(newLane).getByText('Alpha')).toBeInTheDocument()
    expect(within(wonLane).getByText('0 cards')).toBeInTheDocument()
    expect(within(uncategorized).getByText('Beta')).toBeInTheDocument()
    expect(within(uncategorized).getByText('Gamma')).toBeInTheDocument()
  })

  it('uses the table formatting pipeline for card footers and lane aggregates', () => {
    renderBoard()

    const newLane = screen.getByRole('region', { name: 'New lane' })
    const alphaCard = within(newLane).getByRole('button', { name: 'Alpha' })

    expect(within(alphaCard).getByText('HK$123.45')).toBeInTheDocument()
    expect(within(alphaCard).getByText('High')).toHaveClass('text-dt-badge-success')
    expect(within(newLane).getByText(/Total: HK\$123\.45/)).toBeInTheDocument()
  })

  it('calls the existing row click handler from a card', () => {
    const onRowClick = vi.fn()
    renderBoard({ onRowClick })

    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))

    expect(onRowClick).toHaveBeenCalledWith(deals[0])
  })

  it('moves a card optimistically and calls onMove with its row key and destination', () => {
    const onMove = vi.fn(() => new Promise<void>(() => {}))
    renderBoard({ kanban: createKanban({ allowMove: true, onMove }) })
    const transfer = dataTransfer()
    const card = screen.getByRole('button', { name: 'Alpha' })

    fireEvent.dragStart(card, { dataTransfer: transfer })
    expect(card).toHaveClass('opacity-40')
    fireEvent.drop(screen.getByRole('region', { name: 'Closed won lane' }), {
      dataTransfer: transfer,
    })

    expect(onMove).toHaveBeenCalledWith('1', 'Won')
    expect(within(screen.getByRole('region', { name: 'Closed won lane' })).getByText('Alpha')).toBeInTheDocument()
  })

  it('rolls an optimistic move back when onMove rejects', async () => {
    let rejectMove: ((error: Error) => void) | undefined
    const onMove = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectMove = reject }))
    renderBoard({ kanban: createKanban({ allowMove: true, onMove }) })
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Alpha' }), { dataTransfer: transfer })
    fireEvent.drop(screen.getByRole('region', { name: 'Closed won lane' }), {
      dataTransfer: transfer,
    })
    rejectMove?.(new Error('move failed'))

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'New lane' })).getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('reconciles an acknowledged optimistic lane with later authoritative data', async () => {
    const onMove = vi.fn(() => Promise.resolve())
    const board = renderBoard({ kanban: createKanban({ allowMove: true, onMove }) })
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Alpha' }), { dataTransfer: transfer })
    fireEvent.drop(screen.getByRole('region', { name: 'Closed won lane' }), {
      dataTransfer: transfer,
    })

    await waitFor(() => expect(onMove).toHaveBeenCalledWith('1', 'Won'))
    board.rerender(
      <DataTable
        data={deals.map((deal) => deal.id === '1' ? { ...deal, stage: 'New' } : deal)}
        columns={columns}
        rowKey="id"
        storageKey="kanban-board-test"
        defaultGroupBy={[{ field: 'stage', sort: 'asc' }]}
        kanban={createKanban({ allowMove: true, onMove })}
      >
        <KanbanBoard<Deal> />
      </DataTable>,
    )

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'New lane' })).getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('drops an optimistic lane after authoritative data reaches the move target', async () => {
    const onMove = vi.fn(() => new Promise<void>(() => {}))
    const board = renderBoard({ kanban: createKanban({ allowMove: true, onMove }) })
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Alpha' }), { dataTransfer: transfer })
    fireEvent.drop(screen.getByRole('region', { name: 'Closed won lane' }), {
      dataTransfer: transfer,
    })
    board.rerender(
      <DataTable
        data={deals.map((deal) => deal.id === '1' ? { ...deal, stage: 'Won' } : deal)}
        columns={columns}
        rowKey="id"
        storageKey="kanban-board-test"
        defaultGroupBy={[{ field: 'stage', sort: 'asc' }]}
        kanban={createKanban({ allowMove: true, onMove })}
      >
        <KanbanBoard<Deal> />
      </DataTable>,
    )

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'Closed won lane' })).getByText('Alpha')).toBeInTheDocument()
    })

    board.rerender(
      <DataTable
        data={deals.map((deal) => deal.id === '1' ? { ...deal, stage: 'New' } : deal)}
        columns={columns}
        rowKey="id"
        storageKey="kanban-board-test"
        defaultGroupBy={[{ field: 'stage', sort: 'asc' }]}
        kanban={createKanban({ allowMove: true, onMove })}
      >
        <KanbanBoard<Deal> />
      </DataTable>,
    )

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'New lane' })).getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('does not accept drops in the synthetic Uncategorized lane', () => {
    const onMove = vi.fn()
    renderBoard({ kanban: createKanban({ allowMove: true, onMove }) })
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Alpha' }), { dataTransfer: transfer })
    const uncategorized = screen.getByRole('region', { name: 'Uncategorized lane' })
    fireEvent.dragOver(uncategorized)
    fireEvent.drop(uncategorized, { dataTransfer: transfer })

    expect(onMove).not.toHaveBeenCalled()
    expect(uncategorized).not.toHaveClass('bg-dt-bg-secondary')
  })

  it('keeps a real Uncategorized lane separate from the synthetic fallback lane', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderBoard({
        data: [
          { ...deals[0], stage: 'Uncategorized' },
          deals[1],
        ],
        kanban: createKanban({ laneOrder: ['New', 'Won', 'Uncategorized'] }),
      })

      const uncategorizedLanes = screen.getAllByRole('region', { name: 'Uncategorized lane' })
      expect(uncategorizedLanes).toHaveLength(2)
      expect(uncategorizedLanes.some((lane) => within(lane).queryByText('Alpha'))).toBe(true)
      expect(uncategorizedLanes.some((lane) => within(lane).queryByText('Beta'))).toBe(true)
      expect(uncategorizedLanes.some((lane) => (
        within(lane).queryByText('Alpha') && within(lane).queryByText('Beta')
      ))).toBe(false)
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    ['rejection', (error: Error) => Promise.reject(error)],
    ['synchronous throw', (error: Error) => { throw error }],
  ])('reports a %s after rolling back the move', async (_case, move) => {
    const error = new Error('move failed')
    const onMoveError = vi.fn()
    renderBoard({
      kanban: createKanban({
        allowMove: true,
        onMove: () => move(error),
        onMoveError,
      }),
    })
    const transfer = dataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Alpha' }), { dataTransfer: transfer })
    fireEvent.drop(screen.getByRole('region', { name: 'Closed won lane' }), {
      dataTransfer: transfer,
    })

    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'New lane' })).getByText('Alpha')).toBeInTheDocument()
      expect(onMoveError).toHaveBeenCalledWith(error, '1', 'Won')
    })
  })

  it('renders non-draggable cards when movement is disabled', () => {
    renderBoard({ kanban: createKanban({ allowMove: false, onMove: vi.fn() }) })

    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('draggable', 'false')
  })
})
