import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef, RowAction } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
  { id: '3', name: 'Charlie', amount: 50 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('DataTable', () => {
  it('renders preset="full" with search, toolbar, content, and footer', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText(/3 of 3 records/)).toBeInTheDocument()
  })

  it('shows no view toggle for existing consumers without kanban configuration', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)

    expect(screen.queryByRole('button', { name: 'Board view' })).not.toBeInTheDocument()
  })

  it('seeds the first group from laneField and persists uncontrolled view mode', async () => {
    const kanbanColumns: ColumnDef<(typeof data)[number]>[] = [
      ...columns,
      { id: 'stage', label: 'Stage', type: 'text', options: ['Open', 'Won'] },
    ]
    const kanbanData = data.map((row, index) => ({
      ...row,
      stage: index === 0 ? 'Open' : 'Won',
    }))
    const props = {
      columns: kanbanColumns,
      data: kanbanData,
      rowKey: 'id' as const,
      storageKey: 'view-mode-round-trip',
      preset: 'full' as const,
      kanban: {
        laneField: 'stage',
        card: { titleField: 'name' },
      },
    }
    const onViewModeChange = vi.fn()
    localStorage.setItem('view-mode-round-trip-groupby', JSON.stringify({
      groups: [],
      collapsed: [],
      showEmpty: false,
    }))
    const first = render(<DataTable {...props} onViewModeChange={onViewModeChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Board view' }))

    expect(onViewModeChange).toHaveBeenCalledWith('kanban')
    expect(screen.getByRole('region', { name: 'Open lane' })).toBeInTheDocument()
    expect(screen.getByText(/3 of 3 records/)).toBeInTheDocument()
    await waitFor(() => {
      expect(localStorage.getItem('view-mode-round-trip-viewmode')).toBe('kanban')
    })

    first.unmount()
    render(<DataTable {...props} />)

    expect(screen.getByRole('region', { name: 'Open lane' })).toBeInTheDocument()
  })

  it('honors controlled viewMode while notifying toggle changes', () => {
    const onViewModeChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="full"
        viewMode="kanban"
        onViewModeChange={onViewModeChange}
        defaultGroupBy={[{ field: 'name', sort: 'asc' }]}
        kanban={{ card: { titleField: 'name' } }}
      />,
    )

    expect(screen.getByRole('region', { name: 'Alice lane' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }))
    expect(onViewModeChange).toHaveBeenCalledWith('table')
    expect(screen.getByRole('region', { name: 'Alice lane' })).toBeInTheDocument()
  })

  it('threads footerKpis through preset="full"', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="full"
        footerKpis={[{ label: 'Revenue', value: '$12,400', accent: 'info' }]}
      />,
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$12,400')).toHaveClass('text-dt-primary')
  })

  it('renders preset="minimal" without toolbar', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders preset="none" with custom children', () => {
    render(
      <DataTable columns={columns} data={data} rowKey="id" preset="none">
        <DataTable.Content />
      </DataTable>
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} rowKey="id" preset="full" />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
  })

  it('does not crash with empty columns', () => {
    render(<DataTable columns={[]} data={data} rowKey="id" preset="full" />)
    expect(screen.getByText(/3 of 3 records/)).toBeInTheDocument()
  })

  it('fires onRowClick with the correct row', () => {
    const onClick = vi.fn()
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" onRowClick={onClick} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(onClick).toHaveBeenCalledWith(data[0])
  })

  it('fires onRowClick via keyboard Enter', () => {
    const onClick = vi.fn()
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" onRowClick={onClick} />)
    const row = screen.getByText('Alice').closest('tr')!
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledWith(data[0])
  })

  describe('row actions', () => {
    it('keeps a consumer actions column configurable', () => {
      const domainColumns: ColumnDef<(typeof data)[number]>[] = [
        { id: 'actions', label: 'Domain Actions', type: 'text' },
        ...columns,
      ]

      render(
        <DataTable
          columns={domainColumns}
          data={data.map((row) => ({ ...row, actions: 'Review' }))}
          rowKey="id"
          preset="full"
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }))

      expect(
        screen.getByRole('button', { name: 'Toggle Domain Actions visibility' }),
      ).toBeInTheDocument()
    })

    it('keeps the generated actions column out of configurable column state', () => {
      const actions: RowAction<(typeof data)[number]>[] = [
        { key: 'edit', title: 'Edit row', onClick: vi.fn() },
      ]

      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          preset="full"
          actions={actions}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }))

      expect(screen.queryByRole('button', { name: 'Toggle Actions visibility' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Edit row' })).toHaveLength(data.length)
    })

    it('lets a consumer actions column coexist with generated row actions without duplicate keys', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const domainColumns: ColumnDef<(typeof data)[number]>[] = [
        ...columns,
        {
          id: 'actions',
          label: 'Domain Actions',
          type: 'custom',
          render: () => 'Review state',
        },
      ]
      const actions: RowAction<(typeof data)[number]>[] = [
        { key: 'edit', title: 'Edit row', onClick: vi.fn() },
      ]

      try {
        render(
          <DataTable
            columns={domainColumns}
            data={data}
            rowKey="id"
            preset="minimal"
            actions={actions}
          />,
        )

        expect(screen.getAllByText('Review state')).toHaveLength(data.length)
        expect(screen.getAllByRole('button', { name: 'Edit row' })).toHaveLength(data.length)
        expect(
          errorSpy.mock.calls.some((call) => call.some((value) => String(value).includes('same key'))),
        ).toBe(false)
      } finally {
        errorSpy.mockRestore()
      }
    })

    it('renders actions for every row with accessible labels', () => {
      const actions: RowAction<(typeof data)[number]>[] = [
        { key: 'edit', title: 'Edit row', icon: <span>Edit</span>, onClick: vi.fn() },
      ]

      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          preset="minimal"
          actions={actions}
        />,
      )

      expect(screen.getAllByRole('button', { name: 'Edit row' })).toHaveLength(data.length)
    })

    it('passes the domain row to the action without triggering onRowClick', () => {
      const onActionClick = vi.fn()
      const onRowClick = vi.fn()
      const actions: RowAction<(typeof data)[number]>[] = [
        { key: 'edit', title: 'Edit row', onClick: onActionClick },
      ]

      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          preset="minimal"
          actions={actions}
          onRowClick={onRowClick}
        />,
      )

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit row' })[0])

      expect(onActionClick).toHaveBeenCalledWith(data[0])
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('hides an action only for rows where show returns false', () => {
      const actions: RowAction<(typeof data)[number]>[] = [
        {
          key: 'delete',
          title: 'Delete row',
          onClick: vi.fn(),
          show: (row) => row.id !== '2',
        },
      ]

      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          preset="minimal"
          actions={actions}
        />,
      )

      expect(screen.getAllByRole('button', { name: 'Delete row' })).toHaveLength(2)
      expect(
        within(screen.getByText('Bob').closest('tr')!).queryByRole('button', { name: 'Delete row' }),
      ).not.toBeInTheDocument()
    })

    it('applies destructive hover styling to danger actions', () => {
      const actions: RowAction<(typeof data)[number]>[] = [
        {
          key: 'delete',
          title: 'Delete row',
          onClick: vi.fn(),
          variant: 'danger',
        },
      ]

      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          preset="minimal"
          actions={actions}
        />,
      )

      expect(screen.getAllByRole('button', { name: 'Delete row' })[0]).toHaveClass(
        'hover:bg-dt-negative/10',
        'hover:text-dt-negative',
      )
    })
  })
})
