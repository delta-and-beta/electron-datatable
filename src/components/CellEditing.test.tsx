import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

type TestRow = {
  id: string
  name: string
  amount: number
  due: string
  status: string
}

const row: TestRow = {
  id: 'row-1',
  name: 'Alice',
  amount: 125,
  due: '2026-07-12',
  status: 'Open',
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('inline cell editing', () => {
  it.each([
    [{ id: 'name', label: 'Name', type: 'text', editable: true }, 'Alice', 'text'],
    [{ id: 'amount', label: 'Amount', type: 'number', editable: true }, '125', 'number'],
    [{ id: 'due', label: 'Due', type: 'date', editable: true }, 'Jul 12, 2026', 'date'],
  ] as const)('opens a $2 editor on double-click', (column, displayedValue, inputType) => {
    render(
      <DataTable
        columns={[column] as ColumnDef<TestRow>[]}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.doubleClick(screen.getByText(displayedValue))

    expect(screen.getByLabelText(`Edit ${column.label}`)).toHaveAttribute('type', inputType)
  })

  it('uses a select when options are present', () => {
    const columns: ColumnDef<TestRow>[] = [{
      id: 'status',
      label: 'Status',
      type: 'text',
      editable: true,
      options: ['Open', { value: 'won', label: 'Won' }],
    }]

    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Open'))

    const editor = screen.getByRole('combobox', { name: 'Edit Status' })
    expect(editor).toHaveValue('Open')
    expect(screen.getByRole('option', { name: 'Won' })).toHaveValue('won')
  })

  it('shows a static currency prefix beside a number editor', () => {
    const columns: ColumnDef<TestRow>[] = [{
      id: 'amount',
      label: 'Amount',
      type: 'currency',
      editable: true,
      symbol: 'HK$',
    }]

    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.doubleClick(screen.getByText('HK$125.00'))

    expect(screen.getByText('HK$')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('spinbutton', { name: 'Edit Amount' })).toHaveValue(125)
  })

  it.each([
    ['name', 'Name', 'text', 'Alice', 'Alicia', 'Alicia'],
    ['amount', 'Amount', 'number', '125', '250.5', 250.5],
    ['due', 'Due', 'date', 'Jul 12, 2026', '2026-08-03', '2026-08-03'],
  ] as const)('commits a typed $2 value with Enter', async (id, label, type, displayedValue, inputValue, expected) => {
    const onCellEdit = vi.fn()
    const columns: ColumnDef<TestRow>[] = [{ id, label, type, editable: true } as ColumnDef<TestRow>]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
      />,
    )

    const cell = screen.getByText(displayedValue).closest('td')!
    cell.focus()
    fireEvent.keyDown(cell, { key: 'Enter' })
    const editor = screen.getByLabelText(`Edit ${label}`)
    fireEvent.change(editor, { target: { value: inputValue } })
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledWith(row, id, expected)
    await waitFor(() => expect(screen.queryByLabelText(`Edit ${label}`)).not.toBeInTheDocument())
  })

  it('cancels with Escape without calling onCellEdit', () => {
    const onCellEdit = vi.fn()
    const columns: ColumnDef<TestRow>[] = [{ id: 'name', label: 'Name', type: 'text', editable: true }]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Alice'))
    const editor = screen.getByRole('textbox', { name: 'Edit Name' })
    fireEvent.change(editor, { target: { value: 'Alicia' } })
    fireEvent.keyDown(editor, { key: 'Escape' })

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('reverts a rejected optimistic edit and reports the error', async () => {
    const error = new Error('write failed')
    const onCellEdit = vi.fn().mockRejectedValue(error)
    const onCellEditError = vi.fn()
    const columns: ColumnDef<TestRow>[] = [{ id: 'name', label: 'Name', type: 'text', editable: true }]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
        onCellEditError={onCellEditError}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Alice'))
    const editor = screen.getByRole('textbox', { name: 'Edit Name' })
    fireEvent.change(editor, { target: { value: 'Alicia' } })
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(screen.getByText('Alicia')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(onCellEditError).toHaveBeenCalledWith(error, row, 'name')
  })

  it('ignores editable on custom-rendered columns and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns: ColumnDef<TestRow>[] = [{
      id: 'name',
      label: 'Name',
      type: 'text',
      editable: true,
      render: (value) => <strong>Custom {String(value)}</strong>,
    }]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Custom Alice'))

    expect(screen.queryByRole('textbox', { name: 'Edit Name' })).not.toBeInTheDocument()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[DataTable] editable is ignored for custom-rendered columns')
  })

  it('does not trigger onRowClick from an editable cell or its editor', () => {
    const onRowClick = vi.fn()
    const columns: ColumnDef<TestRow>[] = [{ id: 'name', label: 'Name', type: 'text', editable: true }]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onRowClick={onRowClick}
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Alice'))
    fireEvent.doubleClick(screen.getByText('Alice'))
    const editor = screen.getByRole('textbox', { name: 'Edit Name' })
    fireEvent.click(editor)
    fireEvent.keyDown(editor, { key: 'Escape' })

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('commits with Tab and opens the next editable cell in the row', async () => {
    const onCellEdit = vi.fn()
    const columns: ColumnDef<TestRow>[] = [
      { id: 'name', label: 'Name', type: 'text', editable: true },
      { id: 'amount', label: 'Amount', type: 'number' },
      { id: 'status', label: 'Status', type: 'text', editable: true },
    ]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Alice'))
    const editor = screen.getByRole('textbox', { name: 'Edit Name' })
    fireEvent.change(editor, { target: { value: 'Alicia' } })
    fireEvent.keyDown(editor, { key: 'Tab' })

    expect(onCellEdit).toHaveBeenCalledWith(row, 'name', 'Alicia')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Edit Status' })).toHaveFocus())
  })

  it('commits on blur and clears its transient overlay when data refreshes', async () => {
    const onCellEdit = vi.fn()
    const columns: ColumnDef<TestRow>[] = [{ id: 'name', label: 'Name', type: 'text', editable: true }]
    const view = render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Alice'))
    const editor = screen.getByRole('textbox', { name: 'Edit Name' })
    fireEvent.change(editor, { target: { value: 'Alicia' } })
    fireEvent.blur(editor)

    expect(onCellEdit).toHaveBeenCalledWith(row, 'name', 'Alicia')
    expect(screen.getByText('Alicia')).toBeInTheDocument()

    view.rerender(
      <DataTable
        columns={columns}
        data={[{ ...row, name: 'Alice from refresh' }]}
        rowKey="id"
        preset="minimal"
        onCellEdit={onCellEdit}
      />,
    )

    await waitFor(() => expect(screen.getByText('Alice from refresh')).toBeInTheDocument())
  })

  it('does not expose editing in Kanban view', () => {
    const columns: ColumnDef<TestRow>[] = [
      { id: 'name', label: 'Name', type: 'text', editable: true },
      { id: 'status', label: 'Status', type: 'text', options: ['Open'] },
    ]
    render(
      <DataTable
        columns={columns}
        data={[row]}
        rowKey="id"
        preset="full"
        viewMode="kanban"
        kanban={{ laneField: 'status', card: { titleField: 'name' } }}
        onCellEdit={vi.fn()}
      />,
    )

    fireEvent.doubleClick(screen.getByText('Alice'))

    expect(screen.queryByLabelText('Edit Name')).not.toBeInTheDocument()
  })
})
