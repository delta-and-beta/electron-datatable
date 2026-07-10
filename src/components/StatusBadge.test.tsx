import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, type BadgeVariant } from './StatusBadge'

describe('StatusBadge', () => {
  it.each<[BadgeVariant, string, string]>([
    ['success', 'bg-dt-positive/10', 'text-dt-positive'],
    ['warning', 'bg-amber-500/10', 'text-amber-500'],
    ['error', 'bg-dt-negative/10', 'text-dt-negative'],
    ['info', 'bg-dt-primary/10', 'text-dt-primary'],
    ['neutral', 'bg-dt-muted/10', 'text-dt-muted'],
    ['purple', 'bg-purple-500/10', 'text-purple-500'],
    ['cyan', 'bg-cyan-500/10', 'text-cyan-500'],
  ])('renders the %s variant', (variant, backgroundClass, textClass) => {
    render(<StatusBadge variant={variant}>{variant}</StatusBadge>)

    expect(screen.getByText(variant)).toHaveClass(backgroundClass, textClass)
  })

  it('defaults to neutral and merges a custom class name', () => {
    render(<StatusBadge className="uppercase">Paused</StatusBadge>)

    expect(screen.getByText('Paused')).toHaveClass(
      'bg-dt-muted/10',
      'text-dt-muted',
      'uppercase',
    )
  })
})
