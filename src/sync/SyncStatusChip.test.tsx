import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncStatusChip } from './SyncStatusChip'
import type { SyncRunResult } from './types'

const successfulResult: SyncRunResult = {
  fetched: 10,
  created: 8,
  updated: 2,
  deleted: 0,
  errors: [],
  startedAt: '2026-07-11T09:58:00.000Z',
  finishedAt: '2026-07-11T10:00:00.000Z',
  cursor: '10',
}

describe('SyncStatusChip', () => {
  it('renders an idle last-synced status with relative time', () => {
    render(
      <SyncStatusChip
        result={successfulResult}
        now={new Date('2026-07-11T10:02:00.000Z')}
      />,
    )

    expect(screen.getByText('Synced 2 minutes ago')).toHaveClass('text-dt-badge-success')
  })

  it('renders running phase and progress with a spinner', () => {
    render(
      <SyncStatusChip
        progress={{ phase: 'pulling', current: 20, total: 100 }}
        result={successfulResult}
      />,
    )

    expect(screen.getByText('Pulling 20/100')).toBeInTheDocument()
    expect(screen.getByLabelText('Sync in progress')).toHaveClass('animate-spin')
  })

  it('renders an error status with its message as a tooltip', () => {
    render(
      <SyncStatusChip
        progress={{ phase: 'error', current: 20, message: 'Connection timed out' }}
        result={successfulResult}
      />,
    )

    expect(screen.getByText('Sync failed')).toHaveClass('text-dt-badge-error')
    expect(screen.getByText('Sync failed').closest('[title]')).toHaveAttribute('title', 'Connection timed out')
  })
})
