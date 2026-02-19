import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GroupHeader } from './GroupHeader'
import type { ColumnDef } from '../../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'currency', currency: 'HKD' },
  { id: 'qty', label: 'Quantity', type: 'number' },
  { id: 'status', label: 'Status', type: 'text' },
]

const sums: Record<string, number> = {
  amount: 1234.5,
  qty: 42,
}

function renderGroupHeader(overrides = {}) {
  return render(
    <table>
      <tbody>
        <GroupHeader
          groupKey="Food"
          fieldLabel="Category"
          level={0}
          count={5}
          isCollapsed={false}
          onToggle={() => {}}
          columns={columns}
          sums={sums}
          {...overrides}
        />
      </tbody>
    </table>,
  )
}

describe('GroupHeader', () => {
  it('renders one td per column', () => {
    renderGroupHeader()
    const rows = screen.getAllByRole('row')
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    const cells = visibleRow.querySelectorAll('td')
    expect(cells).toHaveLength(4)
  })

  it('shows group key and count in first cell', () => {
    renderGroupHeader()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('formats currency sum in the correct column cell', () => {
    renderGroupHeader()
    const text = document.body.textContent!
    expect(text).toMatch(/HKD|HK\$/)
    expect(text).toMatch(/1,234\.50/)
  })

  it('formats number sum in the correct column cell', () => {
    renderGroupHeader()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('leaves non-aggregatable cells empty', () => {
    renderGroupHeader()
    const rows = screen.getAllByRole('row')
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    const cells = visibleRow.querySelectorAll('td')
    // Last cell (status, type=text) should be empty
    expect(cells[3].textContent).toBe('')
  })

  it('applies negative color class for negative sums', () => {
    renderGroupHeader({ sums: { amount: -500, qty: 10 } })
    const negativeEl = document.querySelector('.text-dt-negative')
    expect(negativeEl).not.toBeNull()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    renderGroupHeader({ onToggle })
    const rows = screen.getAllByRole('row')
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    fireEvent.click(visibleRow)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('respects sumInGroup=false to skip aggregation', () => {
    const cols: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'amount', label: 'Amount', type: 'currency', currency: 'HKD', sumInGroup: false },
    ]
    renderGroupHeader({ columns: cols, sums: { amount: 999 } })
    const text = document.body.textContent!
    expect(text).not.toMatch(/999/)
  })
})
