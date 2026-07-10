import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FooterKpi } from '../index'
import type { ColumnDef } from '../types'
import { DataTable } from './DataTable'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
]

const data = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
]

const kpis: FooterKpi[] = [
  { label: 'Revenue', value: '$12,400' },
  { label: 'Growth', value: '+8%', accent: 'positive' },
]

describe('Footer KPI tiles', () => {
  it('renders KPI labels and values alongside the record count', () => {
    render(
      <DataTable columns={columns} data={data} rowKey="id">
        <DataTable.Footer kpis={kpis} />
      </DataTable>,
    )

    expect(screen.getByText('2 of 2 records')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$12,400')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('+8%')).toBeInTheDocument()
  })

  it('applies the accent class to the KPI value', () => {
    render(
      <DataTable columns={columns} data={data} rowKey="id">
        <DataTable.Footer kpis={kpis} />
      </DataTable>,
    )

    expect(screen.getByText('+8%')).toHaveClass('text-dt-positive')
  })

  it('renders children instead of KPIs when both are provided', () => {
    render(
      <DataTable columns={columns} data={data} rowKey="id">
        <DataTable.Footer kpis={kpis}>
          {({ filteredCount }) => <span>Custom total: {filteredCount}</span>}
        </DataTable.Footer>
      </DataTable>,
    )

    expect(screen.getByText('Custom total: 2')).toBeInTheDocument()
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
    expect(screen.queryByText('2 of 2 records')).not.toBeInTheDocument()
  })
})
