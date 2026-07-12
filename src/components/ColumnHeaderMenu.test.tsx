import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', name: 'Bob', amount: 200 },
  { id: '2', name: 'Alice', amount: 100 },
]

function openMenu(label = 'Name') {
  fireEvent.click(screen.getByRole('button', { name: `Open menu for ${label}` }))
  return screen.getByRole('dialog', { name: `${label} field menu` })
}

beforeEach(() => {
  localStorage.clear()
})

describe('ColumnHeaderMenu', () => {
  it('opens from a keyboard-reachable chevron without sorting the column', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const trigger = screen.getByRole('button', { name: 'Open menu for Name' })
    const header = trigger.closest('th')!

    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Name field menu' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(header).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts ascending and descending from explicit actions', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const header = screen.getByText('Name').closest('th')!

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Sort A→Z' }))
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Sort Z→A' }))
    expect(header).toHaveAttribute('aria-sort', 'descending')
  })

  it('seeds a condition and opens the full-preset filter panel', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Filter by this field' }))

    const panel = screen.getByRole('dialog', { name: 'Filter configuration' })
    expect(within(panel).getByDisplayValue('Name')).toBeInTheDocument()
  })

  it.each(['minimal', 'none'] as const)(
    'omits filtering when the %s preset mounts no filter panel',
    (preset) => {
      render(
        <DataTable columns={columns} data={data} rowKey="id" preset={preset}>
          {preset === 'none' ? <DataTable.Content /> : undefined}
        </DataTable>,
      )

      expect(within(openMenu()).queryByRole('button', {
        name: 'Filter by this field',
      })).not.toBeInTheDocument()
    },
  )

  it('groups, freezes through the visible index, and hides the field', () => {
    const view = render(
      <DataTable columns={columns} data={data} rowKey="id" storageKey="header-actions" preset="full" />,
    )

    fireEvent.click(within(openMenu('Amount')).getByRole('button', { name: 'Group by this field' }))
    expect(screen.getByRole('button', { name: /Grouped by 1 field/ })).toBeInTheDocument()

    fireEvent.click(within(openMenu('Amount')).getByRole('button', { name: 'Freeze up to here' }))
    expect(screen.getByText('Name').closest('th')).toHaveClass('dt-frozen-header')
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveClass('dt-frozen-header')

    fireEvent.click(within(openMenu('Amount')).getByRole('button', { name: 'Hide field' }))
    expect(screen.queryByRole('columnheader', { name: /Amount/ })).not.toBeInTheDocument()
    view.unmount()
  })

  it('disables unsupported built-ins with reasons and no-ops', () => {
    const restricted: ColumnDef[] = [{
      id: 'tags',
      label: 'Tags',
      type: 'tags',
      sortable: false,
      filterable: false,
      groupable: false,
    }]
    render(
      <DataTable
        columns={restricted}
        data={[{ id: '1', tags: ['One'] }]}
        rowKey="id"
        preset="full"
      />,
    )

    const menu = within(openMenu('Tags'))
    const sort = menu.getByRole('button', { name: 'Sort A→Z' })
    const filter = menu.getByRole('button', { name: 'Filter by this field' })
    const group = menu.getByRole('button', { name: 'Group by this field' })

    expect(sort).toBeDisabled()
    expect(sort).toHaveAccessibleDescription('Sorting is disabled for this field')
    expect(filter).toBeDisabled()
    expect(filter).toHaveAccessibleDescription('Filtering is disabled for this field')
    expect(group).toBeDisabled()
    expect(group).toHaveAccessibleDescription('Tag fields cannot be grouped')
    fireEvent.click(sort)
    fireEvent.click(filter)
    fireEvent.click(group)
    expect(screen.getByText('Tags').closest('th')).not.toHaveAttribute('aria-sort')
  })

  it('disables grouping at the three-level cap with a reason', () => {
    const cappedColumns: ColumnDef[] = [
      ...columns,
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'owner', label: 'Owner', type: 'text' },
    ]
    render(
      <DataTable
        columns={cappedColumns}
        data={[{ id: '1', name: 'A', amount: 1, status: 'Open', owner: 'Lee' }]}
        rowKey="id"
        defaultGroupBy={[
          { field: 'name', sort: 'asc' },
          { field: 'status', sort: 'asc' },
          { field: 'owner', sort: 'asc' },
        ]}
        preset="minimal"
      />,
    )

    const group = within(openMenu('Amount')).getByRole('button', { name: 'Group by this field' })
    expect(group).toBeDisabled()
    expect(group).toHaveAccessibleDescription('Only 3 group levels are supported')
  })

  it('appends consumer items in order with separators, variants, and disabled reasons', () => {
    const first = vi.fn()
    const disabled = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        preset="minimal"
        columnMenuItems={(column) => [
          { key: 'edit', label: `Edit ${column.label}`, onSelect: first },
          {
            key: 'remove',
            label: 'Remove locally',
            onSelect: () => {},
            variant: 'danger',
            separatorBefore: true,
          },
          {
            key: 'blocked',
            label: 'Blocked action',
            onSelect: disabled,
            disabled: true,
            disabledReason: 'Read only',
          },
        ]}
      />,
    )

    const dialog = openMenu()
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.slice(-3).map((button) => button.textContent)).toEqual([
      'Edit Name',
      'Remove locally',
      'Blocked action',
    ])
    expect(within(dialog).getAllByRole('separator')).toHaveLength(2)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Name' }))
    expect(first).toHaveBeenCalledOnce()

    const blocked = within(openMenu()).getByRole('button', { name: 'Blocked action' })
    expect(blocked).toHaveAccessibleDescription('Read only')
    fireEvent.click(blocked)
    expect(disabled).not.toHaveBeenCalled()
    expect(within(screen.getByRole('dialog', { name: 'Name field menu' })).getByRole('button', {
      name: 'Remove locally',
    })).toHaveClass('text-dt-negative')
  })

  it('keeps resize drag isolated from the menu', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const header = screen.getByText('Name').closest('th')!

    fireEvent.mouseDown(within(header).getByTitle('Drag to resize'), { clientX: 100 })

    expect(screen.queryByRole('dialog', { name: 'Name field menu' })).not.toBeInTheDocument()
    fireEvent.mouseUp(document)
  })
})
