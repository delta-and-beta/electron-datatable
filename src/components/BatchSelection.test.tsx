import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDataTable } from '../context'
import type { BulkAction, ColumnDef } from '../types'
import { DataTable } from './DataTable'

interface Person {
  id: string
  name: string
  amount: number
}

const columns: ColumnDef<Person>[] = [
  { id: 'name', label: 'Name', type: 'text', width: '120px' },
  { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
]

const data: Person[] = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
  { id: '3', name: 'Charlie', amount: 50 },
]

const noopAction: BulkAction<Person> = {
  key: 'archive',
  title: 'Archive',
  onClick: vi.fn(),
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('batch selection', () => {
  it('selects all rows in the filtered set and dispatches only those domain rows', async () => {
    const onClick = vi.fn()
    localStorage.setItem('batch-filter-filters', JSON.stringify({
      enabled: true,
      root: {
        id: 'root',
        conjunction: 'and',
        conditions: [{
          id: 'name-filter',
          field: 'name',
          operator: 'contains',
          value: 'Ali',
        }],
        groups: [],
      },
    }))

    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="batch-filter"
        preset="minimal"
        bulkActions={[{ key: 'archive', title: 'Archive', onClick }]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible rows' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onClick).toHaveBeenCalledWith([data[0]])
    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument())
  })

  it('selects an inclusive range on shift-click', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        bulkActions={[noopAction]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Charlie' }), { shiftKey: true })

    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Bob' })).toBeChecked()
  })

  it('sets the select-all checkbox indeterminate for a partial selection', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        bulkActions={[noopAction]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))

    const selectAll = screen.getByRole('checkbox', { name: 'Select all visible rows' }) as HTMLInputElement
    expect(selectAll).not.toBeChecked()
    expect(selectAll.indeterminate).toBe(true)
  })

  it('renders the selected count, filters actions with show, and styles danger actions', () => {
    const actions: BulkAction<Person>[] = [
      {
        key: 'archive',
        title: 'Archive',
        onClick: vi.fn(),
        show: (rows) => rows.length > 1,
      },
      {
        key: 'delete',
        title: 'Delete selected',
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
        bulkActions={actions}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete selected' })).toHaveClass(
      'border-dt-negative/30',
      'bg-dt-negative/10',
      'text-dt-negative',
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bob' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })

  it('keeps selection until an async action resolves, then clears it', async () => {
    let resolveAction!: () => void
    const onClick = vi.fn(() => new Promise<void>((resolve) => {
      resolveAction = resolve
    }))
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        bulkActions={[{ key: 'archive', title: 'Archive', onClick }]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onClick).toHaveBeenCalledWith([data[0]])
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    await act(async () => resolveAction())

    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Select Alice' })).not.toBeChecked()
  })

  it('clears selection when the search changes', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="full"
        bulkActions={[noopAction]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Bob' } })

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('clears selection when the filter changes', () => {
    function FilterToggle() {
      const { filter } = useDataTable<Person>()
      return <button type="button" onClick={() => filter.setEnabled(!filter.enabled)}>Toggle filter</button>
    }

    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="none"
        bulkActions={[noopAction]}
      >
        <DataTable.Content />
        <FilterToggle />
      </DataTable>,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle filter' }))

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('does not trigger onRowClick from a row checkbox or the clear-selection button', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        bulkActions={[noopAction]}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

    expect(onRowClick).not.toHaveBeenCalled()
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('keeps the leading selection column and frozen data columns aligned', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        frozenColumns={1}
        bulkActions={[noopAction]}
      />,
    )

    const selectAllCell = screen.getByRole('checkbox', { name: 'Select all visible rows' }).closest('th')!
    const aliceSelectCell = screen.getByRole('checkbox', { name: 'Select Alice' }).closest('td')!
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ })

    expect(selectAllCell).toHaveClass('dt-frozen-header')
    expect(selectAllCell).toHaveStyle({ position: 'sticky', left: '0px', width: '44px' })
    expect(aliceSelectCell).toHaveClass('dt-frozen-cell')
    expect(aliceSelectCell).toHaveStyle({ position: 'sticky', left: '0px', width: '44px' })
    expect(nameHeader).toHaveStyle({ left: '44px' })
    expect(screen.getByText('Alice').closest('td')).toHaveStyle({ left: '44px' })
  })

  it('clears table selection when switching to kanban mode', () => {
    const kanbanColumns: ColumnDef<Person>[] = [
      ...columns,
      { id: 'id', label: 'Lane', type: 'text' },
    ]
    render(
      <DataTable
        columns={kanbanColumns}
        data={data}
        rowKey="id"
        preset="full"
        defaultGroupBy={[{ field: 'id', sort: 'asc' }]}
        kanban={{ card: { titleField: 'name' } }}
        bulkActions={[noopAction]}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }))

    expect(screen.getByRole('checkbox', { name: 'Select Alice' })).not.toBeChecked()
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('does not enable selection without bulk actions', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
