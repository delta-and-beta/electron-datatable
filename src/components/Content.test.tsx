import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef, RowAction } from '../types'

const EXPECTED_DEFAULT_MIN_COLUMN_WIDTH = '140px'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'hidden', label: 'Hidden', type: 'text', visible: false },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
]

beforeEach(() => {
  localStorage.clear()
})

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

  it('uses the resized header width for body cells', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="resized-body-width"
        preset="minimal"
      />,
    )

    const nameHeader = screen.getByText('Name').closest('th')!
    nameHeader.getBoundingClientRect = () => ({
      width: Number.parseFloat(nameHeader.style.width) || 120,
    } as DOMRect)

    fireEvent.mouseDown(within(nameHeader).getByTitle('Drag to resize'), { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 180 })
    fireEvent.mouseUp(document)

    expect(nameHeader).toHaveStyle({ width: '200px' })
    expect(screen.getByText('Alice').closest('td')).toHaveStyle({ width: '200px' })
  })

  it('switches a width-less table to fixed layout on its first resize', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        storageKey="first-resize-fixed-layout"
        preset="minimal"
      />,
    )

    const table = container.querySelector('table')!
    const nameHeader = screen.getByText('Name').closest('th')!
    nameHeader.getBoundingClientRect = () => ({ width: 120 } as DOMRect)

    expect(table).toHaveStyle({ tableLayout: 'auto' })
    expect(table.querySelector('colgroup')).not.toBeInTheDocument()

    fireEvent.mouseDown(within(nameHeader).getByTitle('Drag to resize'), { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 180 })
    fireEvent.mouseUp(document)

    expect(table).toHaveStyle({ tableLayout: 'fixed' })
    expect(nameHeader).toHaveStyle({ width: '200px' })
    expect(table.querySelector('colgroup')).toBeInTheDocument()
  })

  it('materializes every painted column width before resizing one column', () => {
    const resizeColumns: ColumnDef[] = Array.from({ length: 6 }, (_, index) => ({
      id: `field${index + 1}`,
      label: `Field ${index + 1}`,
      type: 'text',
    }))
    const paintedWidths = [160, 180, 200, 220, 240, 260]
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const columnIndex = resizeColumns.findIndex((column) => (
          this.textContent?.includes(column.label)
        ))
        return { width: paintedWidths[columnIndex] ?? 0 } as DOMRect
      })

    try {
      const { container } = render(
        <DataTable
          columns={resizeColumns}
          data={[Object.fromEntries([
            ['id', '1'],
            ...resizeColumns.map((column, index) => [column.id, `Value ${index + 1}`]),
          ])]}
          rowKey="id"
          storageKey="materialize-resize-widths"
          frozenColumns={1}
          preset="minimal"
        />,
      )

      const secondHeader = screen.getByText('Field 2').closest('th')!
      fireEvent.mouseDown(within(secondHeader).getByTitle('Drag to resize'), { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: 160 })
      fireEvent.mouseUp(document)

      const colWidths = Array.from(container.querySelectorAll('col')).map((col) => col.style.width)
      expect(colWidths).toEqual(['160px', '240px', '200px', '220px', '240px', '260px'])
      expect(screen.getByText('Field 1').closest('th')).toHaveStyle({
        left: '0px',
        width: '160px',
      })
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('renders a complete colgroup with resolved and equal-share widths', () => {
    const fixedColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: 120 },
      { id: 'amount', label: 'Amount', type: 'number' },
      { id: 'status', label: 'Status', type: 'text' },
    ]
    const { container } = render(
      <DataTable
        columns={fixedColumns}
        data={[{ id: '1', name: 'Alice', amount: 100, status: 'Open' }]}
        rowKey="id"
        storageKey="complete-colgroup"
        preset="minimal"
      />,
    )

    const table = container.querySelector('table')!
    const colWidths = Array.from(table.querySelectorAll('col')).map((col) => col.style.width)

    expect(table).toHaveStyle({ tableLayout: 'fixed' })
    expect(colWidths).toHaveLength(3)
    expect(colWidths[0]).toBe('140px')
    expect(colWidths[1]).not.toBe('')
    expect(colWidths[1]).toBe(colWidths[2])
  })

  it('clamps a narrow 20-column fixed table and gives it horizontal overflow width', () => {
    const wideColumns: ColumnDef[] = Array.from({ length: 20 }, (_, index) => ({
      id: `field${index}`,
      label: `Field ${index}`,
      type: 'text',
      ...(index === 0 ? { width: '80px' } : {}),
    }))
    const row = Object.fromEntries([
      ['id', '1'],
      ...wideColumns.map((column, index) => [column.id, `Value ${index}`]),
    ])
    const { container } = render(
      <div style={{ width: 320 }}>
        <DataTable
          columns={wideColumns}
          data={[row]}
          rowKey="id"
          storageKey="narrow-twenty-columns"
          preset="full"
        />
      </div>,
    )

    const table = container.querySelector('table')!
    const cols = Array.from(table.querySelectorAll('col'))
    const colWidths = cols.map((col) => col.style.width)

    expect(cols).toHaveLength(20)
    expect(colWidths[0]).toBe(EXPECTED_DEFAULT_MIN_COLUMN_WIDTH)
    expect(colWidths.every((width) => width.includes(EXPECTED_DEFAULT_MIN_COLUMN_WIDTH))).toBe(true)
    const equalShare = 'calc((100% - 80px) / 19)'
    const expectedWidths = [
      EXPECTED_DEFAULT_MIN_COLUMN_WIDTH,
      ...Array.from(
        { length: 19 },
        () => `max(${equalShare}, ${EXPECTED_DEFAULT_MIN_COLUMN_WIDTH})`,
      ),
    ]
    expect(table.style.minWidth).toBe(`calc(${expectedWidths.join(' + ')})`)
    expect(table.closest('.overflow-auto')).toBeInTheDocument()
  })

  it('clamps resize drags at the column minimum width', () => {
    render(
      <DataTable
        columns={[{ id: 'name', label: 'Name', type: 'text', width: '200px' }]}
        data={[{ id: '1', name: 'Alice' }]}
        rowKey="id"
        storageKey="resize-minimum"
        preset="minimal"
      />,
    )

    const nameHeader = screen.getByText('Name').closest('th')!
    nameHeader.getBoundingClientRect = () => ({ width: 200 } as DOMRect)
    fireEvent.mouseDown(within(nameHeader).getByTitle('Drag to resize'), { clientX: 200 })
    fireEvent.mouseMove(document, { clientX: 0 })
    fireEvent.mouseUp(document)

    expect(nameHeader).toHaveStyle({ width: EXPECTED_DEFAULT_MIN_COLUMN_WIDTH })
  })

  it('honors a per-column minWidth override', () => {
    const { container } = render(
      <DataTable
        columns={[{
          id: 'name',
          label: 'Name',
          type: 'text',
          width: '100px',
          minWidth: '180px',
        }]}
        data={[{ id: '1', name: 'Alice' }]}
        rowKey="id"
        storageKey="custom-minimum"
        preset="minimal"
      />,
    )

    expect(container.querySelector('col')).toHaveStyle({ width: '180px' })
    expect(container.querySelector('table')).toHaveStyle({ minWidth: 'calc(180px)' })
  })

  it('uses min-width-clamped painted widths for three frozen-column offsets', () => {
    const frozenColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '80px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '100px' },
      { id: 'status', label: 'Status', type: 'text', width: '120px' },
    ]
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return { width: Number.parseFloat(this.style.width) || 0 } as DOMRect
      })

    try {
      render(
        <DataTable
          columns={frozenColumns}
          data={[{ id: '1', name: 'Alice', amount: 100, status: 'Open' }]}
          rowKey="id"
          storageKey="frozen-clamped-three"
          frozenColumns={3}
          preset="minimal"
        />,
      )

      expect(screen.getByText('Name').closest('th')).toHaveStyle({ left: '0px' })
      expect(screen.getByText('Amount').closest('th')).toHaveStyle({ left: '140px' })
      expect(screen.getByText('Status').closest('th')).toHaveStyle({ left: '280px' })
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('truncates long header labels instead of allowing overlap', () => {
    render(
      <DataTable
        columns={[{
          id: 'long',
          label: 'A very long header label that must not overlap',
          type: 'text',
          width: '140px',
        }]}
        data={[{ id: '1', long: 'Value' }]}
        rowKey="id"
        storageKey="header-truncation"
        preset="minimal"
      />,
    )

    expect(screen.getByText('A very long header label that must not overlap')).toHaveClass(
      'min-w-0',
      'truncate',
    )
  })

  it('measures auto-width columns for offsets without locking their rendered widths', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 120 } as DOMRect)

    try {
      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey="id"
          storageKey="auto-widths"
          frozenColumns={2}
          preset="minimal"
        />,
      )

      expect(screen.getByText('Name').closest('th')!.style.width).toBe('')
      expect(screen.getByText('Alice').closest('td')!.style.width).toBe('')
      expect(screen.getByText('Amount').closest('th')).toHaveStyle({ left: '120px' })
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('freezes the first two visible columns with cumulative resolved-width offsets', () => {
    const frozenColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '120px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
      { id: 'status', label: 'Status', type: 'text', width: '100px' },
    ]

    render(
      <DataTable
        columns={frozenColumns}
        data={[{ id: '1', name: 'Alice', amount: 100, status: 'Open' }]}
        rowKey="id"
        storageKey="frozen-two"
        frozenColumns={2}
        preset="minimal"
      />,
    )

    const nameHeader = screen.getByText('Name').closest('th')!
    const amountHeader = screen.getByText('Amount').closest('th')!
    const statusHeader = screen.getByText('Status').closest('th')!
    const nameCell = screen.getByText('Alice').closest('td')!
    const amountCell = screen.getByText('100').closest('td')!

    expect(nameHeader).toHaveClass('dt-frozen-header', 'z-30')
    expect(nameHeader).toHaveStyle({ position: 'sticky', left: '0px' })
    expect(amountHeader).toHaveClass('dt-frozen-header', 'dt-frozen-edge')
    expect(amountHeader).toHaveStyle({ position: 'sticky', left: '140px' })
    expect(statusHeader).not.toHaveClass('dt-frozen-header')
    expect(nameCell).toHaveClass('dt-frozen-cell', 'z-10')
    expect(nameCell).toHaveStyle({ position: 'sticky', left: '0px' })
    expect(amountCell).toHaveClass('dt-frozen-cell', 'dt-frozen-edge')
    expect(amountCell).toHaveStyle({ position: 'sticky', left: '140px' })
    expect(screen.getByText('Open').closest('td')).toHaveClass('relative', 'z-0')
  })

  it('prefers painted header widths over configured widths for frozen offsets', () => {
    const frozenColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '120px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
    ]
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return { width: this.textContent?.includes('Name') ? 175 : 80 } as DOMRect
      })

    try {
      render(
        <DataTable
          columns={frozenColumns}
          data={[{ id: '1', name: 'Alice', amount: 100 }]}
          rowKey="id"
          storageKey="frozen-painted-width"
          frozenColumns={2}
          preset="minimal"
        />,
      )

      expect(screen.getByText('Amount').closest('th')).toHaveStyle({ left: '175px' })
      expect(screen.getByText('100').closest('td')).toHaveStyle({ left: '175px' })
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('recomputes later frozen offsets live after resizing a frozen column', () => {
    const frozenColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '120px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
    ]

    render(
      <DataTable
        columns={frozenColumns}
        data={[{ id: '1', name: 'Alice', amount: 100 }]}
        rowKey="id"
        storageKey="frozen-resize"
        frozenColumns={2}
        preset="minimal"
      />,
    )

    const nameHeader = screen.getByText('Name').closest('th')!
    nameHeader.getBoundingClientRect = () => ({
      width: Number.parseFloat(nameHeader.style.width) || 120,
    } as DOMRect)
    fireEvent.mouseDown(within(nameHeader).getByTitle('Drag to resize'), { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 180 })
    fireEvent.mouseUp(document)

    expect(screen.getByText('Amount').closest('th')).toHaveStyle({ left: '220px' })
    expect(screen.getByText('100').closest('td')).toHaveStyle({ left: '220px' })
  })

  it('recomputes the frozen set and offsets after order and visibility changes', () => {
    const configurableColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '120px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
      { id: 'status', label: 'Status', type: 'text', width: '100px' },
    ]

    render(
      <DataTable
        columns={configurableColumns}
        data={[{ id: '1', name: 'Alice', amount: 100, status: 'Open' }]}
        rowKey="id"
        storageKey="frozen-reconfigure"
        frozenColumns={2}
        preset="full"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Status up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Status up' }))

    expect(screen.getByRole('columnheader', { name: /Status/ })).toHaveStyle({ left: '0px' })
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ left: '140px' })
    expect(screen.getByRole('columnheader', { name: /Amount/ })).not.toHaveClass('dt-frozen-header')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Status visibility' }))

    expect(screen.queryByRole('columnheader', { name: /Status/ })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ left: '0px' })
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveStyle({ left: '140px' })
  })

  it('never freezes the generated actions pseudo-column', () => {
    const actions: RowAction<(typeof data)[number]>[] = [
      { key: 'edit', title: 'Edit row', onClick: vi.fn() },
    ]

    render(
      <DataTable
        columns={columns}
        data={data}
        actions={actions}
        rowKey="id"
        storageKey="frozen-actions"
        frozenColumns={99}
        preset="minimal"
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Edit row' })[0].closest('td')).not.toHaveClass(
      'dt-frozen-cell',
    )
  })

  it('keeps grouped rows full-width while their leading cells share frozen offsets and widths', () => {
    const groupedColumns: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', width: '120px' },
      { id: 'amount', label: 'Amount', type: 'number', width: '80px' },
      { id: 'status', label: 'Status', type: 'text', width: '100px' },
    ]

    render(
      <DataTable
        columns={groupedColumns}
        data={[{ id: '1', name: 'Alice', amount: 100, status: 'Open' }]}
        rowKey="id"
        storageKey="grouped-frozen"
        frozenColumns={2}
        defaultGroupBy={[{ field: 'status', sort: 'asc' }]}
        preset="minimal"
      />,
    )

    const groupRow = screen.getByRole('button', { name: /Status: Open/ })
    const groupCells = groupRow.querySelectorAll('td')
    expect(groupCells).toHaveLength(3)
    expect(groupCells[0]).toHaveClass('dt-group-frozen-cell', 'z-20')
    expect(groupCells[0]).toHaveStyle({ left: '0px', width: '140px' })
    expect(groupCells[1]).toHaveClass('dt-group-frozen-cell', 'dt-frozen-edge')
    expect(groupCells[1]).toHaveStyle({ left: '140px', width: '140px' })
    expect(screen.getByText('Alice').closest('td')).toHaveClass('dt-frozen-cell')
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

  it.each([
    ['number', '100'],
    ['currency', '$100.00'],
  ] as const)('uses tabular numerals for %s body cells', (type, expectedText) => {
    const numericColumns: ColumnDef[] = [
      type === 'currency'
        ? { id: 'amount', label: 'Amount', type, symbol: '$' }
        : { id: 'amount', label: 'Amount', type },
    ]

    render(
      <DataTable
        columns={numericColumns}
        data={[{ id: '1', amount: 100 }]}
        rowKey="id"
        preset="minimal"
      />,
    )

    expect(screen.getByText(expectedText).closest('td')).toHaveClass('tabular-nums')
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

    expect(screen.getByText('active')).toHaveClass(
      'bg-dt-badge-success/10',
      'text-dt-badge-success',
    )
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

    expect(screen.getByText('paused')).toHaveClass(
      'bg-dt-badge-neutral/10',
      'text-dt-badge-neutral',
    )
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

    expect(screen.getByText('Remote')).toHaveClass(
      'bg-dt-badge-neutral/10',
      'text-dt-badge-neutral',
    )
    expect(screen.getByText('VIP')).toHaveClass(
      'bg-dt-badge-neutral/10',
      'text-dt-badge-neutral',
    )
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
