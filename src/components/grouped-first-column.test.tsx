import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

/**
 * Regression tests for the grouped first-column redesign:
 * - indent is added on top of the 16px cell baseline (never below it)
 * - a single <colgroup> drives widths for header, data, and group rows
 * - collapse paths are escaped so '/' in group values cannot collide
 * - the group disclosure is a real <button> with sums in its accessible name
 */

const columns: ColumnDef[] = [
  { id: 'category', label: 'Category', type: 'text' },
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', category: 'Food', name: 'Alice', amount: 100 },
  { id: '2', category: 'Food', name: 'Bob', amount: 200 },
  { id: '3', category: 'Travel', name: 'Cara', amount: 300 },
]

function firstDataCellOf(text: string): HTMLTableCellElement {
  const row = screen.getByText(text).closest('tr')!
  return row.querySelectorAll('td')[0] as HTMLTableCellElement
}

beforeEach(() => {
  localStorage.clear()
})

describe('grouped first-column indentation', () => {
  it('keeps ungrouped data cells at the default padding (no inline override)', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" storageKey="gi0" preset="minimal" />)
    expect(firstDataCellOf('Alice').style.paddingLeft).toBe('')
  })

  it('depth-1: indents data rows to 40px (16 baseline + 24 chevron gutter), never left of the header', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="gi1"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    expect(firstDataCellOf('Alice').style.paddingLeft).toBe('40px')
    // level-0 group label cell keeps the 16px baseline
    const groupButton = screen.getByRole('button', { name: /Category: Food/ })
    const labelCell = groupButton.closest('td')!
    expect(labelCell.style.paddingLeft).toBe('16px')
  })

  it('depth-2: header levels step by 14px and leaf rows sit under the deepest label', () => {
    const cols: ColumnDef[] = [...columns, { id: 'status', label: 'Status', type: 'text' }]
    const rows = data.map((d, i) => ({ ...d, status: i % 2 ? 'Open' : 'Closed' }))
    render(
      <DataTable
        columns={cols}
        data={rows}
        rowKey="id"
        storageKey="gi2"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }, { field: 'status' }]}
      />,
    )
    const level0Cell = screen.getAllByRole('button', { name: /Category: Food/ })[0].closest('td')!
    const level1Cell = screen.getAllByRole('button', { name: /Status: / })[0].closest('td')!
    expect(level0Cell.style.paddingLeft).toBe('16px')
    expect(level1Cell.style.paddingLeft).toBe('30px')
    // leaf data rows: 16 + 24 + (2-1)*14 = 54
    expect(firstDataCellOf('Alice').style.paddingLeft).toBe('54px')
  })
})

describe('single-source column widths (colgroup)', () => {
  it('renders a colgroup and applies the persisted resized width to the <col>, not the cells', () => {
    localStorage.setItem(
      'gw1-columns',
      JSON.stringify({ visible: ['category', 'name', 'amount'], order: ['category', 'name', 'amount'], widths: { name: 90 } }),
    )
    const { container } = render(
      <DataTable columns={columns} data={data} rowKey="id" storageKey="gw1" preset="minimal" />,
    )
    const cols = container.querySelectorAll('colgroup col')
    expect(cols).toHaveLength(3)
    expect((cols[1] as HTMLElement).style.width).toBe('90px')
    // no competing inline width on header or data cells
    const nameTh = screen.getByText('Name').closest('th')!
    expect(nameTh.style.width).toBe('')
    expect(firstDataCellOf('Alice').style.width).toBe('')
  })

  it('uses the column definition width for <col> when no resize is persisted', () => {
    const cols: ColumnDef[] = [{ ...columns[0], width: '220px' }, columns[1], columns[2]]
    const { container } = render(
      <DataTable columns={cols} data={data} rowKey="id" storageKey="gw2" preset="minimal" />,
    )
    const colEls = container.querySelectorAll('colgroup col')
    expect((colEls[0] as HTMLElement).style.width).toBe('220px')
  })

  it('group header cells carry no inline width (grid comes from colgroup)', () => {
    const cols: ColumnDef[] = [{ ...columns[0], width: '220px' }, columns[1], columns[2]]
    render(
      <DataTable
        columns={cols}
        data={data}
        rowKey="id"
        storageKey="gw3"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    const labelCell = screen.getByRole('button', { name: /Category: Food/ }).closest('td')!
    expect(labelCell.style.width).toBe('')
  })
})

describe('collapse-path escaping', () => {
  it('collapsing a top-level "N/A" group does not collapse nested N → A', () => {
    const cols: ColumnDef[] = [
      { id: 'cat', label: 'Cat', type: 'text' },
      { id: 'sub', label: 'Sub', type: 'text' },
      { id: 'name', label: 'Name', type: 'text' },
    ]
    const rows = [
      { id: '1', cat: 'N', sub: 'A', name: 'InsideN' },
      { id: '2', cat: 'N/A', sub: 'B', name: 'InsideNA' },
    ]
    render(
      <DataTable
        columns={cols}
        data={rows}
        rowKey="id"
        storageKey="gc1"
        preset="minimal"
        defaultGroupBy={[{ field: 'cat' }, { field: 'sub' }]}
      />,
    )
    expect(screen.getByText('InsideN')).toBeInTheDocument()
    expect(screen.getByText('InsideNA')).toBeInTheDocument()

    // collapse the top-level "N/A" group
    fireEvent.click(screen.getByRole('button', { name: /Cat: N\/A/ }))
    expect(screen.queryByText('InsideNA')).not.toBeInTheDocument()
    // the nested N → A subgroup must be unaffected
    expect(screen.getByText('InsideN')).toBeInTheDocument()
  })
})

describe('group header accessibility', () => {
  it('exposes a disclosure button with count and aggregate sums in the accessible name', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="ga1"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    const button = screen.getByRole('button', { name: /Category: Food, 2 records/ })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    // Food group: 100 + 200 = 300
    expect(button.getAttribute('aria-label')).toMatch(/Amount total 300/)
  })

  it('does not override the group row semantics with role="button"', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="ga2"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    expect(container.querySelectorAll('tr[role="button"]')).toHaveLength(0)
  })

  it('toggles collapse from the disclosure button (click = keyboard activation on a real button)', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="ga3"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    const button = screen.getByRole('button', { name: /Category: Food/ })
    fireEvent.click(button)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Category: Food/ })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('group containment rail', () => {
  it('grouped data rows carry the accent rail on their first cell', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="gr1"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    expect(firstDataCellOf('Alice').style.boxShadow).toContain('inset 3px')
  })

  it('ungrouped data rows have no rail', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" storageKey="gr2" preset="minimal" />)
    expect(firstDataCellOf('Alice').style.boxShadow).toBe('')
  })
})

describe('group label band', () => {
  it('spans the label cell across the leading non-aggregatable columns', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="gs1"
        preset="minimal"
        defaultGroupBy={[{ field: 'category' }]}
      />,
    )
    const labelCell = screen.getByRole('button', { name: /Category: Food/ }).closest('td') as HTMLTableCellElement
    // category + name are non-aggregatable; amount (number) ends the run
    expect(labelCell.colSpan).toBe(2)
    const headerRow = labelCell.closest('tr')!
    expect(headerRow.querySelectorAll('td')).toHaveLength(2)
  })
})
