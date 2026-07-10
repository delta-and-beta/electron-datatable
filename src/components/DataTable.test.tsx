import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
