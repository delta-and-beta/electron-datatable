import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchingProvider, type UseMatchingReturn } from '../../matching-context'
import { ConfidenceBadge } from './ConfidenceBadge'
import { BulkDropZone } from './BulkDropZone'
import { MatchingReportDialog } from './MatchingReportDialog'
import { MatchingReportContent } from './MatchingReportContent'

function createMockMatching(overrides?: Partial<UseMatchingReturn>): UseMatchingReturn {
  return {
    state: 'idle',
    logs: [],
    progress: null,
    matches: [],
    unmatchedFiles: [],
    error: undefined,
    selectedMatches: new Set<string>(),
    startMatching: vi.fn(),
    toggleMatch: vi.fn(),
    confirmMatches: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    bulkDropVisible: false,
    dropHandlers: {
      onDragEnter: vi.fn(),
      onDragLeave: vi.fn(),
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
    },
    getRowDropHandlers: vi.fn(() => ({
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
    })),
    enabled: true,
    ...overrides,
  }
}

function renderWithMatching(ui: React.ReactNode, matching: UseMatchingReturn) {
  return render(
    <MatchingProvider value={matching}>{ui}</MatchingProvider>,
  )
}

describe('ConfidenceBadge', () => {
  it('renders high confidence with correct label', () => {
    render(<ConfidenceBadge confidence="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders medium confidence with correct label', () => {
    render(<ConfidenceBadge confidence="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders low confidence with correct label', () => {
    render(<ConfidenceBadge confidence="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })
})

describe('BulkDropZone', () => {
  it('renders nothing when bulkDropVisible is false', () => {
    const { container } = renderWithMatching(<BulkDropZone />, createMockMatching())
    expect(container.innerHTML).toBe('')
  })

  it('renders overlay when bulkDropVisible is true', () => {
    renderWithMatching(<BulkDropZone />, createMockMatching({ bulkDropVisible: true }))
    expect(screen.getByText('Drop files to bulk match')).toBeInTheDocument()
  })

  it('renders nothing when matching context is null', () => {
    const { container } = render(<BulkDropZone />)
    expect(container.innerHTML).toBe('')
  })
})

describe('MatchingReportDialog', () => {
  it('renders nothing when state is idle', () => {
    const { container } = renderWithMatching(
      <MatchingReportDialog />,
      createMockMatching({ state: 'idle' }),
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when state is done', () => {
    const { container } = renderWithMatching(
      <MatchingReportDialog />,
      createMockMatching({ state: 'done' }),
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders built-in modal during reviewing state', () => {
    renderWithMatching(
      <MatchingReportDialog />,
      createMockMatching({ state: 'reviewing' }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Matching results')).toBeInTheDocument()
  })

  it('calls reset on Escape key', () => {
    const matching = createMockMatching({ state: 'reviewing' })
    renderWithMatching(<MatchingReportDialog />, matching)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(matching.reset).toHaveBeenCalledOnce()
  })

  it('uses custom wrapper when provided', () => {
    const wrapper = vi.fn(({ children }) => <div data-testid="custom-wrapper">{children}</div>)
    renderWithMatching(
      <MatchingReportDialog wrapper={wrapper} />,
      createMockMatching({ state: 'reviewing' }),
    )
    expect(screen.getByTestId('custom-wrapper')).toBeInTheDocument()
    expect(wrapper).toHaveBeenCalledWith(expect.objectContaining({ open: true }))
  })
})

describe('MatchingReportContent', () => {
  it('shows progress bar during processing', () => {
    renderWithMatching(
      <MatchingReportContent />,
      createMockMatching({
        state: 'ocr',
        progress: { phase: 'ocr', current: 1, total: 3 },
        logs: ['Starting OCR...'],
      }),
    )
    expect(screen.getByText('Running OCR\u2026')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('shows error message in error state', () => {
    renderWithMatching(
      <MatchingReportContent />,
      createMockMatching({
        state: 'error',
        error: 'OCR service unavailable',
        logs: ['Error occurred'],
      }),
    )
    expect(screen.getByText('OCR service unavailable')).toBeInTheDocument()
  })

  it('shows matched files with checkboxes in reviewing state', () => {
    const matching = createMockMatching({
      state: 'reviewing',
      matches: [
        { file: 'data', filename: 'invoice.pdf', transaction_id: 'txn1', confidence: 'high', reason: 'Amount match' },
      ],
      selectedMatches: new Set(['invoice.pdf']),
    })

    renderWithMatching(<MatchingReportContent />, matching)
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(matching.toggleMatch).toHaveBeenCalledWith('invoice.pdf')
  })

  it('shows unmatched files in reviewing state', () => {
    renderWithMatching(
      <MatchingReportContent />,
      createMockMatching({
        state: 'reviewing',
        unmatchedFiles: [
          { file: 'data', filename: 'mystery.pdf', reason: 'No matching transaction found' },
        ],
      }),
    )
    expect(screen.getByText('mystery.pdf')).toBeInTheDocument()
    expect(screen.getByText('No matching transaction found')).toBeInTheDocument()
  })

  it('shows confirm button with selected count', () => {
    renderWithMatching(
      <MatchingReportContent />,
      createMockMatching({
        state: 'reviewing',
        matches: [
          { file: 'data', filename: 'a.pdf', transaction_id: 'txn1', confidence: 'high', reason: 'Match' },
          { file: 'data', filename: 'b.pdf', transaction_id: 'txn2', confidence: 'medium', reason: 'Match' },
        ],
        selectedMatches: new Set(['a.pdf', 'b.pdf']),
      }),
    )
    expect(screen.getByText('Confirm 2 matches')).toBeInTheDocument()
  })

  it('calls reset when cancel is clicked', () => {
    const matching = createMockMatching({ state: 'reviewing' })
    renderWithMatching(<MatchingReportContent />, matching)
    fireEvent.click(screen.getByText('Cancel'))
    expect(matching.reset).toHaveBeenCalledOnce()
  })
})
