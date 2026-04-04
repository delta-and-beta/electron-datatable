import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMatching } from './useMatching'
import type { MatchingAdapter, OcrResult, MatchResult } from '../matching-types'
import type { AttachmentAdapter, Attachment, RowData } from '../types'

// Mock fileToBase64 since jsdom's File doesn't support arrayBuffer()
vi.mock('../lib/matching-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/matching-utils')>()
  return {
    ...original,
    fileToBase64: vi.fn().mockImplementation(() => Promise.resolve('bW9ja2VkLWJhc2U2NA==')),
  }
})

interface TestRow extends RowData {
  id: string
  name: string
  amount: number
}

const testData: TestRow[] = [
  { id: 'txn1', name: 'Vendor A', amount: 100 },
  { id: 'txn2', name: 'Vendor B', amount: 200 },
]

function createMockMatchingAdapter(overrides?: Partial<MatchingAdapter<TestRow>>): MatchingAdapter<TestRow> {
  return {
    ocr: vi.fn().mockResolvedValue([
      { file: 'base64data', filename: 'invoice.pdf', pages: [{ page: 1, text: 'Vendor A $100' }] },
    ] satisfies OcrResult[]),
    match: vi.fn().mockResolvedValue({
      matches: [
        { file: 'base64data', filename: 'invoice.pdf', transaction_id: 'txn1', confidence: 'high', reason: 'Amount matches' },
      ],
      unmatched_files: [],
    } satisfies MatchResult),
    summarize: vi.fn((row: TestRow) => ({
      id: row.id,
      date: '',
      amount: row.amount,
      currency: 'USD',
      description: row.name,
    })),
    ...overrides,
  }
}

function createMockAttachmentAdapter(overrides?: Partial<AttachmentAdapter>): AttachmentAdapter {
  return {
    add: vi.fn().mockResolvedValue({ id: 'att1', filename: 'invoice.pdf', mimeType: 'application/pdf', createdAt: '2026-01-01' } satisfies Attachment),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    getCounts: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeFile(name: string, type: string, content = 'test'): File {
  return new File([content], name, { type })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useMatching', () => {
  it('is disabled when matchingAdapter is null', () => {
    const { result } = renderHook(() =>
      useMatching({ matchingAdapter: null, attachmentAdapter: createMockAttachmentAdapter(), data: testData }),
    )
    expect(result.current.enabled).toBe(false)
    expect(result.current.state).toBe('idle')
  })

  it('is disabled when attachmentAdapter is null', () => {
    const { result } = renderHook(() =>
      useMatching({ matchingAdapter: createMockMatchingAdapter(), attachmentAdapter: null, data: testData }),
    )
    expect(result.current.enabled).toBe(false)
  })

  it('is enabled when both adapters are provided', () => {
    const { result } = renderHook(() =>
      useMatching({
        matchingAdapter: createMockMatchingAdapter(),
        attachmentAdapter: createMockAttachmentAdapter(),
        data: testData,
      }),
    )
    expect(result.current.enabled).toBe(true)
    expect(result.current.state).toBe('idle')
  })

  it('runs full matching flow: reading → ocr → matching → duplicates → reviewing', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('invoice.pdf', 'application/pdf')])
    })

    expect(result.current.state).toBe('reviewing')
    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].transaction_id).toBe('txn1')
    expect(result.current.unmatchedFiles).toHaveLength(0)
    expect(result.current.logs.length).toBeGreaterThan(0)
    expect(matchingAdapter.ocr).toHaveBeenCalledOnce()
    expect(matchingAdapter.match).toHaveBeenCalledOnce()
    expect(matchingAdapter.summarize).toHaveBeenCalledTimes(testData.length)
  })

  it('filters files by MIME type', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([
        makeFile('invoice.pdf', 'application/pdf'),
        makeFile('virus.exe', 'application/octet-stream'),
      ])
    })

    expect(matchingAdapter.ocr).toHaveBeenCalledWith([
      expect.objectContaining({ filename: 'invoice.pdf', mimeType: 'application/pdf' }),
    ])
  })

  it('stays idle when all files are rejected by MIME filter', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('virus.exe', 'application/octet-stream')])
    })

    expect(result.current.state).toBe('idle')
    expect(matchingAdapter.ocr).not.toHaveBeenCalled()
  })

  it('transitions to error when all OCR results have errors', async () => {
    const matchingAdapter = createMockMatchingAdapter({
      ocr: vi.fn().mockResolvedValue([
        { file: 'data', filename: 'bad.pdf', pages: [], error: 'OCR failed' },
      ]),
    })
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('bad.pdf', 'application/pdf')])
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBeDefined()
  })

  it('detects duplicates and moves them to unmatched', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter({
      list: vi.fn().mockResolvedValue([
        { id: 'existing', filename: 'invoice.pdf', mimeType: 'application/pdf', createdAt: '2026-01-01' },
      ]),
    })

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('invoice.pdf', 'application/pdf')])
    })

    expect(result.current.state).toBe('reviewing')
    expect(result.current.matches).toHaveLength(0)
    expect(result.current.unmatchedFiles).toHaveLength(1)
    expect(result.current.unmatchedFiles[0].reason).toContain('Already imported')
  })

  it('toggleMatch adds/removes from selectedMatches', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('invoice.pdf', 'application/pdf')])
    })

    expect(result.current.selectedMatches.has('invoice.pdf')).toBe(true)

    act(() => result.current.toggleMatch('invoice.pdf'))
    expect(result.current.selectedMatches.has('invoice.pdf')).toBe(false)

    act(() => result.current.toggleMatch('invoice.pdf'))
    expect(result.current.selectedMatches.has('invoice.pdf')).toBe(true)
  })

  it('confirmMatches calls attachmentAdapter.add for selected matches', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('invoice.pdf', 'application/pdf')])
    })

    await act(async () => {
      await result.current.confirmMatches()
    })

    expect(attachmentAdapter.add).toHaveBeenCalledWith(
      'txn1', 'invoice.pdf', 'application/pdf', expect.any(String),
    )
    expect(result.current.state).toBe('done')
  })

  it('reset clears all state back to idle', async () => {
    const matchingAdapter = createMockMatchingAdapter()
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    await act(async () => {
      result.current.startMatching([makeFile('invoice.pdf', 'application/pdf')])
    })

    expect(result.current.state).toBe('reviewing')

    act(() => result.current.reset())

    expect(result.current.state).toBe('idle')
    expect(result.current.logs).toEqual([])
    expect(result.current.matches).toEqual([])
    expect(result.current.unmatchedFiles).toEqual([])
    expect(result.current.error).toBeUndefined()
    expect(result.current.selectedMatches.size).toBe(0)
  })

  it('ignores startMatching when state is not idle', async () => {
    const matchingAdapter = createMockMatchingAdapter({
      ocr: vi.fn().mockImplementation(() => new Promise(() => {})),
    })
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    // Start the first matching flow without awaiting completion (OCR never resolves)
    await act(async () => {
      result.current.startMatching([makeFile('first.pdf', 'application/pdf')])
      // Yield to let fileToBase64 resolve and execution reach the OCR call
      await Promise.resolve()
      await Promise.resolve()
    })

    // The first flow should have reached OCR (state is no longer idle)
    expect(matchingAdapter.ocr).toHaveBeenCalledTimes(1)

    // A second call should be ignored since state is not idle
    await act(async () => {
      result.current.startMatching([makeFile('second.pdf', 'application/pdf')])
    })

    expect(matchingAdapter.ocr).toHaveBeenCalledTimes(1)
  })
})
