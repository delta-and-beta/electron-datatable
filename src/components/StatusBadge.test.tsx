import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, type BadgeVariant } from './StatusBadge'

describe('StatusBadge', () => {
  it.each<[BadgeVariant, string, string]>([
    ['success', 'bg-dt-badge-success/10', 'text-dt-badge-success'],
    ['warning', 'bg-dt-badge-warning/10', 'text-dt-badge-warning'],
    ['error', 'bg-dt-badge-error/10', 'text-dt-badge-error'],
    ['info', 'bg-dt-badge-info/10', 'text-dt-badge-info'],
    ['neutral', 'bg-dt-badge-neutral/10', 'text-dt-badge-neutral'],
    ['purple', 'bg-dt-badge-purple/10', 'text-dt-badge-purple'],
    ['cyan', 'bg-dt-badge-cyan/10', 'text-dt-badge-cyan'],
  ])('renders the %s variant', (variant, backgroundClass, textClass) => {
    render(<StatusBadge variant={variant}>{variant}</StatusBadge>)

    expect(screen.getByText(variant)).toHaveClass(backgroundClass, textClass)
  })

  it('defaults to neutral and merges a custom class name', () => {
    render(<StatusBadge className="uppercase">Paused</StatusBadge>)

    expect(screen.getByText('Paused')).toHaveClass(
      'bg-dt-badge-neutral/10',
      'text-dt-badge-neutral',
      'uppercase',
    )
  })
})
