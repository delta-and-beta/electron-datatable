import { describe, it, expect } from 'vitest'
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

  it('formats minor-units currency cells with a symbol override', () => {
    const currencyColumns: ColumnDef[] = [
      {
        id: 'amount',
        label: 'Amount',
        type: 'currency',
        minorUnits: true,
        symbol: 'HK$',
      },
    ]

    render(
      <DataTable
        columns={currencyColumns}
        data={[{ id: '1', amount: 150000 }]}
        rowKey="id"
        preset="minimal"
      />,
    )

    expect(screen.getByText('HK$1,500.00')).toBeInTheDocument()
  })

  it('formats zero-decimal currency cells with a symbol override', () => {
    const currencyColumns: ColumnDef[] = [
      {
        id: 'amount',
        label: 'Amount',
        type: 'currency',
        decimalPlaces: 0,
        symbol: '¥',
      },
    ]

    render(
      <DataTable
        columns={currencyColumns}
        data={[{ id: '1', amount: 500 }]}
        rowKey="id"
        preset="minimal"
      />,
    )

    expect(screen.getByText('¥500')).toBeInTheDocument()
  })

  it('renders the empty placeholder for null currency cells', () => {
    const currencyColumns: ColumnDef[] = [
      {
        id: 'amount',
        label: 'Amount',
        type: 'currency',
        minorUnits: true,
        symbol: 'HK$',
      },
    ]

    render(
      <DataTable
        columns={currencyColumns}
        data={[{ id: '1', amount: null }]}
        rowKey="id"
        preset="minimal"
      />,
    )

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('renders a mapped badge variant for declarative badge columns', () => {
    const badgeColumns: ColumnDef[] = [
      {
        id: 'status',
        label: 'Status',
        type: 'text',
        badgeVariants: { active: 'success' },
      },
    ]

    render(
      <DataTable
        columns={badgeColumns}
        data={[{ id: '1', status: 'active' }]}
        rowKey="id"
        storageKey="badge-mapped"
        preset="minimal"
      />,
    )

    expect(screen.getByText('active')).toHaveClass('bg-dt-positive/10', 'text-dt-positive')
  })

  it('falls back to a neutral badge for unmapped values', () => {
    const badgeColumns: ColumnDef[] = [
      {
        id: 'status',
        label: 'Status',
        type: 'text',
        badgeVariants: { active: 'success' },
      },
    ]

    render(
      <DataTable
        columns={badgeColumns}
        data={[{ id: '1', status: 'paused' }]}
        rowKey="id"
        storageKey="badge-fallback"
        preset="minimal"
      />,
    )

    expect(screen.getByText('paused')).toHaveClass('bg-dt-muted/10', 'text-dt-muted')
  })

  it.each([null, ''])('renders the empty placeholder instead of a badge for %p', (status) => {
    const badgeColumns: ColumnDef[] = [
      {
        id: 'status',
        label: 'Status',
        type: 'text',
        badgeVariants: { active: 'success' },
      },
    ]

    render(
      <DataTable
        columns={badgeColumns}
        data={[{ id: '1', status }]}
        rowKey="id"
        storageKey="badge-empty"
        preset="minimal"
      />,
    )

    const placeholder = screen.getByText('-')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder.tagName).toBe('TD')
  })

  it('keeps custom render precedence over badge variants', () => {
    const badgeColumns: ColumnDef[] = [
      {
        id: 'status',
        label: 'Status',
        type: 'text',
        badgeVariants: { active: 'success' },
        render: (value) => <strong>custom:{String(value)}</strong>,
      },
    ]

    render(
      <DataTable
        columns={badgeColumns}
        data={[{ id: '1', status: 'active' }]}
        rowKey="id"
        storageKey="badge-custom-render"
        preset="minimal"
      />,
    )

    expect(screen.getByText('custom:active').tagName).toBe('STRONG')
    expect(screen.queryByText('active')).not.toBeInTheDocument()
  })

  it('renders tag values as neutral status badges by default', () => {
    const tagColumns: ColumnDef[] = [
      { id: 'tags', label: 'Tags', type: 'tags' },
    ]

    render(
      <DataTable
        columns={tagColumns}
        data={[{ id: '1', tags: ['Remote', 'VIP'] }]}
        rowKey="id"
        storageKey="tags-badges"
        preset="minimal"
      />,
    )

    expect(screen.getByText('Remote')).toHaveClass('bg-dt-muted/10', 'text-dt-muted')
    expect(screen.getByText('VIP')).toHaveClass('bg-dt-muted/10', 'text-dt-muted')
  })

  it('renders the existing placeholder for an empty tags array', () => {
    const tagColumns: ColumnDef[] = [
      { id: 'tags', label: 'Tags', type: 'tags' },
    ]

    render(
      <DataTable
        columns={tagColumns}
        data={[{ id: '1', tags: [] }]}
        rowKey="id"
        storageKey="tags-empty"
        preset="minimal"
      />,
    )

    expect(screen.getByText('-').tagName).toBe('TD')
  })
})
