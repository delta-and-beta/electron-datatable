import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

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
})
