import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DataTable } from '../DataTable'
import type { ColumnDef } from '../../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
]

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Search', () => {
  it('filters data when typing in search', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'Alice' } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('shows clear button when search has value', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'test' } })
    const clearButton = screen.getByLabelText('Clear search')
    expect(clearButton).toBeInTheDocument()
  })

  it('clear button resets search', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'Alice' } })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.click(screen.getByLabelText('Clear search'))
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('ColumnToggle', () => {
  it('opens and closes column panel', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const columnsBtn = screen.getByText('Columns')
    expect(columnsBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(columnsBtn)
    expect(columnsBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: /column/i })).toBeInTheDocument()
  })

  it('closes panel on Escape', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Columns'))
    const dialog = screen.getByRole('dialog', { name: /column/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FilterToolbarButton', () => {
  it('has aria-haspopup and aria-expanded', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const filterBtn = screen.getByText('Filter')
    expect(filterBtn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(filterBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens filter panel on click', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Filter'))
    expect(screen.getByRole('dialog', { name: /filter/i })).toBeInTheDocument()
  })

  it('closes filter panel on Escape', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Filter'))
    const dialog = screen.getByRole('dialog', { name: /filter/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('derives distinct tag choices and filters with a checkbox multi-select', () => {
    const tagColumns: ColumnDef[] = [
      { id: 'tags', label: 'Tags', type: 'tags' },
      { id: 'name', label: 'Name', type: 'text' },
    ]
    const tagData = [
      { id: '1', name: 'Alice', tags: ['Remote', 'VIP'] },
      { id: '2', name: 'Bob', tags: ['Finance'] },
      { id: '3', name: 'Cara', tags: ['Remote'] },
    ]

    render(<DataTable columns={tagColumns} data={tagData} rowKey="id" storageKey="tags-derived" preset="full" />)
    fireEvent.click(screen.getByText('Filter'))
    fireEvent.click(screen.getByText('Add condition'))

    expect(screen.getByRole('checkbox', { name: 'Finance' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Remote' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'VIP' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'VIP' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Finance' }))

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByText('Cara')).not.toBeInTheDocument()
  })

  it('uses configured tag option labels in the multi-select', () => {
    const tagColumns: ColumnDef[] = [{
      id: 'tags',
      label: 'Tags',
      type: 'tags',
      options: [{ value: 'remote', label: 'Remote work' }],
    }]

    render(
      <DataTable
        columns={tagColumns}
        data={[{ id: '1', tags: ['remote'] }]}
        rowKey="id"
        storageKey="tags-options"
        preset="full"
      />,
    )
    fireEvent.click(screen.getByText('Filter'))
    fireEvent.click(screen.getByText('Add condition'))

    expect(screen.getByRole('checkbox', { name: 'Remote work' })).toBeInTheDocument()
  })
})

describe('GroupByToolbarButton', () => {
  it('has aria-haspopup and aria-expanded', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const groupBtn = screen.getByText('Group')
    expect(groupBtn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('excludes tags columns from groupable candidates', () => {
    const tagColumns: ColumnDef[] = [
      { id: 'tags', label: 'Tags', type: 'tags' },
      { id: 'name', label: 'Name', type: 'text' },
    ]

    render(
      <DataTable
        columns={tagColumns}
        data={[{ id: '1', name: 'Alice', tags: ['Remote'] }]}
        rowKey="id"
        storageKey="tags-grouping"
        preset="full"
      />,
    )
    fireEvent.click(screen.getByText('Group'))
    fireEvent.click(screen.getByText('Add group'))

    expect(screen.getByRole('option', { name: 'Name' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tags' })).not.toBeInTheDocument()
  })
})
