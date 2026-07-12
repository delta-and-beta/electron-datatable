import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MenuItem } from './MenuItem'

describe('MenuItem', () => {
  it('renders its icon and invokes selection', () => {
    const onSelect = vi.fn()
    render(<MenuItem icon={<span data-testid="icon">I</span>} label="Rename" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('renders the danger variant', () => {
    render(<MenuItem label="Remove" onSelect={() => {}} variant="danger" />)

    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('text-dt-negative')
  })

  it('blocks disabled selection and exposes the reason', () => {
    const onSelect = vi.fn()
    render(
      <MenuItem
        label="Unavailable"
        onSelect={onSelect}
        disabled
        disabledReason="Not supported for this field"
      />,
    )

    const item = screen.getByRole('button', { name: 'Unavailable' })
    expect(item).toBeDisabled()
    expect(item).toHaveAttribute('title', 'Not supported for this field')
    expect(item).toHaveAccessibleDescription('Not supported for this field')
    fireEvent.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
