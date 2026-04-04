import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'hidden', label: 'Hidden', type: 'text', visible: false },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
]

describe('Content', () => {
  it('renders only visible columns', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('sort header has scope="col" and aria-sort', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const nameHeader = screen.getByText('Name').closest('th')!
    expect(nameHeader).toHaveAttribute('scope', 'col')
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
  })

  it('sort header button triggers sort state change', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const sortButton = screen.getByRole('button', { name: /Name/i })
    fireEvent.click(sortButton)
    const nameHeader = sortButton.closest('th')!
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
  })

  it('empty state row has valid colSpan', () => {
    render(<DataTable columns={columns} data={[]} rowKey="id" preset="minimal" />)
    const emptyCell = screen.getByText('No records found').closest('td')!
    const colSpanValue = parseInt(emptyCell.getAttribute('colspan') ?? '0')
    expect(colSpanValue).toBeGreaterThanOrEqual(1)
  })
})
