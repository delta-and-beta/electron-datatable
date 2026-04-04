# Bulk File Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/matching` entry point that provides bulk file drop → OCR → match → confirm → attach orchestration as a composable layer on top of DataTable.

**Architecture:** A `useMatching` hook manages the full state machine. `MatchingProvider` context distributes state to components. `MatchingDataTable` is a drop-in wrapper composing DataTable + BulkDropZone + MatchingReportDialog. All matching code lives in a separate tsup entry point (`src/matching.ts`) so non-matching consumers pay zero bundle cost.

**Tech Stack:** React 18 hooks, TypeScript generics, vitest + @testing-library/react, tsup multi-entry, Tailwind CSS with `dt-*` tokens.

**Spec:** `docs/superpowers/specs/2026-04-04-bulk-matching-design.md`

---

## File Map

### Files to create

| File | Responsibility |
|------|---------------|
| `src/matching-types.ts` | All matching type definitions (OcrResult, MatchedFile, MatchingAdapter, etc.) |
| `src/matching-context.ts` | MatchingProvider + useMatchingContext hook |
| `src/lib/matching-utils.ts` | Pure functions: fileToBase64, filterByMimeType, DEFAULT_ACCEPTED_TYPES |
| `src/hooks/useMatching.ts` | State machine hook: drag detection, file reading, OCR/match orchestration, confirm/reset |
| `src/components/matching/ConfidenceBadge.tsx` | Presentational: colored badge for high/medium/low confidence |
| `src/components/matching/MatchingProgressBar.tsx` | Presentational: phase label + animated progress bar |
| `src/components/matching/BulkDropZone.tsx` | Overlay shown during file drag |
| `src/components/matching/MatchingReportContent.tsx` | Dialog inner content: processing/reviewing/attaching/error states |
| `src/components/matching/MatchingReportDialog.tsx` | Dialog shell: built-in modal or consumer wrapper |
| `src/components/matching/MatchingDataTable.tsx` | Drop-in wrapper composing DataTable + matching |
| `src/matching.ts` | Entry point re-exporting all public matching API |

### Files to create (tests)

| File | Tests for |
|------|-----------|
| `src/lib/matching-utils.test.ts` | filterByMimeType, DEFAULT_ACCEPTED_TYPES |
| `src/hooks/useMatching.test.tsx` | State machine, drop detection, confirm, reset, errors |
| `src/components/matching/matching-components.test.tsx` | ConfidenceBadge, BulkDropZone, MatchingReportDialog, MatchingReportContent |

### Files to modify

| File | Change |
|------|--------|
| `src/types.ts:97-104` | Update `AttachmentAdapter.add()` signature |
| `src/context.ts:8-43` | Add `refreshAttachmentCounts` to context interface |
| `src/components/DataTable.tsx:25-169` | Wire attachmentCounts via getCounts, add position:relative, expose refreshAttachmentCounts |
| `tsup.config.ts` | Add `src/matching.ts` entry point |
| `package.json:8-23` | Add `"./matching"` export path |

---

### Task 1: Update AttachmentAdapter signature and wire attachmentCounts in core

**Files:**
- Modify: `src/types.ts:97-104`
- Modify: `src/context.ts:8-43`
- Modify: `src/components/DataTable.tsx:25-169`

- [ ] **Step 1: Update AttachmentAdapter.add() in types.ts**

Replace the current `AttachmentAdapter` interface:

```typescript
/** Attachment adapter — consumers implement for their storage backend */
export interface AttachmentAdapter {
  add(rowId: string, filename: string, mimeType: string, dataBase64: string): Promise<Attachment>
  list(rowId: string): Promise<Attachment[]>
  delete(attachmentId: string): Promise<void>
  getCounts(rowIds: string[]): Promise<Record<string, number>>
}
```

- [ ] **Step 2: Add refreshAttachmentCounts to context interface**

In `src/context.ts`, add to the `DataTableContextValue` interface after the `attachmentCounts` field:

```typescript
  attachmentCounts: Record<string, number>
  refreshAttachmentCounts: () => void
```

Update the `useDataTable` return type accordingly (it already returns the full context, so no change needed there).

- [ ] **Step 3: Wire attachmentCounts in DataTable.tsx**

In `src/components/DataTable.tsx`, replace the static `attachmentCounts` state (line 77):

```typescript
  // Attachment counts
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})

  const refreshAttachmentCounts = useCallback(() => {
    if (!attachmentAdapter) return
    const ids = data.map((row) => String(row[rowKey]))
    if (ids.length === 0) return
    attachmentAdapter.getCounts(ids).then(setAttachmentCounts).catch(() => {})
  }, [attachmentAdapter, data, rowKey])

  // Load attachment counts on mount and when data changes
  useEffect(() => {
    refreshAttachmentCounts()
  }, [refreshAttachmentCounts])
```

Add `refreshAttachmentCounts` to the context value in the `useMemo`:

```typescript
  refreshAttachmentCounts,
```

And to the dependency array of the `useMemo`.

- [ ] **Step 4: Add position:relative to DataTable root div**

In the three return branches of `DataTableRoot`, change the wrapper `<div>` to include `relative`:

```tsx
<div className={cn('relative', className)}>
```

Import `cn` from `'../lib/utils'` if not already imported.

- [ ] **Step 5: Run typecheck and existing tests**

Run: `npm run typecheck && npm test`
Expected: All pass. The signature change is types-only; no callers exist in the package.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/context.ts src/components/DataTable.tsx
git commit -m "feat: update AttachmentAdapter.add() signature, wire attachmentCounts in core"
```

---

### Task 2: Matching types and pure utilities

**Files:**
- Create: `src/matching-types.ts`
- Create: `src/lib/matching-utils.ts`
- Create: `src/lib/matching-utils.test.ts`

- [ ] **Step 1: Write matching-utils tests**

Create `src/lib/matching-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { filterByMimeType, DEFAULT_ACCEPTED_TYPES } from './matching-utils'

describe('DEFAULT_ACCEPTED_TYPES', () => {
  it('includes PDF, PNG, JPEG, GIF', () => {
    expect(DEFAULT_ACCEPTED_TYPES).toContain('application/pdf')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/png')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/jpeg')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/gif')
  })
})

describe('filterByMimeType', () => {
  const makeFile = (name: string, type: string): File =>
    new File(['content'], name, { type })

  it('keeps files with accepted MIME types', () => {
    const files = [
      makeFile('doc.pdf', 'application/pdf'),
      makeFile('photo.png', 'image/png'),
    ]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(2)
  })

  it('rejects files with unaccepted MIME types', () => {
    const files = [
      makeFile('app.exe', 'application/octet-stream'),
      makeFile('data.csv', 'text/csv'),
    ]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(0)
  })

  it('filters a mix of valid and invalid files', () => {
    const files = [
      makeFile('doc.pdf', 'application/pdf'),
      makeFile('app.exe', 'application/octet-stream'),
      makeFile('photo.jpg', 'image/jpeg'),
    ]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(2)
    expect(result.map(f => f.name)).toEqual(['doc.pdf', 'photo.jpg'])
  })

  it('returns empty array for empty input', () => {
    expect(filterByMimeType([], DEFAULT_ACCEPTED_TYPES)).toEqual([])
  })

  it('uses custom accepted types when provided', () => {
    const files = [
      makeFile('doc.pdf', 'application/pdf'),
      makeFile('photo.png', 'image/png'),
    ]
    const result = filterByMimeType(files, ['image/png'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('photo.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/matching-utils.test.ts`
Expected: FAIL — module `./matching-utils` not found.

- [ ] **Step 3: Create matching-types.ts**

Create `src/matching-types.ts`:

```typescript
import type { RowData } from './types'

/** OCR result for a single file */
export interface OcrResult {
  file: string
  filename: string
  pages: Array<{ page: number; text: string }>
  error?: string
}

/** A file successfully matched to a transaction */
export interface MatchedFile {
  file: string
  filename: string
  transaction_id: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

/** A file that could not be matched */
export interface UnmatchedFile {
  file: string
  filename: string
  reason: string
}

/** Result from the matching adapter */
export interface MatchResult {
  matches: MatchedFile[]
  unmatched_files: UnmatchedFile[]
}

/** Simplified transaction representation for the matcher */
export interface TransactionSummary {
  id: string
  date: string
  amount: number
  currency: string
  description: string
}

/** Structured progress update from matching */
export interface MatchingProgress {
  message: string
  phase?: 'reading' | 'ocr' | 'matching' | 'duplicates'
  current?: number
  total?: number
}

/** Consumer-provided adapter for OCR and matching backends */
export interface MatchingAdapter<T extends RowData = RowData> {
  ocr(files: Array<{ filename: string; mimeType: string; dataBase64: string }>): Promise<OcrResult[]>
  match(
    ocrResults: OcrResult[],
    transactions: TransactionSummary[],
    onProgress: (progress: MatchingProgress) => void,
  ): Promise<MatchResult>
  summarize(row: T): TransactionSummary
}
```

- [ ] **Step 4: Create matching-utils.ts**

Create `src/lib/matching-utils.ts`:

```typescript
/** Default MIME types accepted for bulk matching */
export const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
] as const

/** Filter files by accepted MIME types */
export function filterByMimeType(files: File[], acceptedTypes: readonly string[]): File[] {
  return files.filter((f) => acceptedTypes.includes(f.type))
}

/** Read a File as base64-encoded string */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/matching-utils.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 6: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS — matching-types.ts imports RowData from core, no circular deps.

- [ ] **Step 7: Commit**

```bash
git add src/matching-types.ts src/lib/matching-utils.ts src/lib/matching-utils.test.ts
git commit -m "feat(matching): add matching types and pure utility functions"
```

---

### Task 3: Matching context

**Files:**
- Create: `src/matching-context.ts`

- [ ] **Step 1: Create matching-context.ts**

Create `src/matching-context.ts`:

```typescript
import { createContext, useContext } from 'react'
import type { MatchedFile, UnmatchedFile } from './matching-types'

/** State shape exposed by useMatching hook */
export interface UseMatchingReturn {
  // State
  state: 'idle' | 'reading' | 'ocr' | 'matching' | 'duplicates' | 'reviewing' | 'attaching' | 'done' | 'error'
  logs: string[]
  progress: { phase: string; current: number; total: number } | null
  matches: MatchedFile[]
  unmatchedFiles: UnmatchedFile[]
  error: string | undefined
  selectedMatches: Set<string>

  // Actions
  startMatching: (files: File[]) => void
  toggleMatch: (filename: string) => void
  confirmMatches: () => Promise<void>
  reset: () => void

  // Drop zone
  bulkDropVisible: boolean
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }

  // Row-level attachment
  getRowDropHandlers: (rowId: string) => {
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }

  // Whether matching is active (both adapters present)
  enabled: boolean
}

const MatchingContext = createContext<UseMatchingReturn | null>(null)

export const MatchingProvider = MatchingContext.Provider

export function useMatchingContext(): UseMatchingReturn | null {
  return useContext(MatchingContext)
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/matching-context.ts
git commit -m "feat(matching): add MatchingProvider context and UseMatchingReturn type"
```

---

### Task 4: useMatching hook — core state machine

**Files:**
- Create: `src/hooks/useMatching.ts`
- Create: `src/hooks/useMatching.test.tsx`

- [ ] **Step 1: Write hook tests**

Create `src/hooks/useMatching.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMatching } from './useMatching'
import type { MatchingAdapter, OcrResult, MatchResult } from '../matching-types'
import type { AttachmentAdapter, Attachment, RowData } from '../types'

// --- Test helpers ---

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

// --- Tests ---

beforeEach(() => {
  vi.restoreAllMocks()
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

    // Only the PDF should reach OCR
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

  it('ignores drop when state is not idle', async () => {
    const matchingAdapter = createMockMatchingAdapter({
      ocr: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
    })
    const attachmentAdapter = createMockAttachmentAdapter()

    const { result } = renderHook(() =>
      useMatching({ matchingAdapter, attachmentAdapter, data: testData }),
    )

    // Start first matching (will hang at OCR)
    act(() => {
      result.current.startMatching([makeFile('first.pdf', 'application/pdf')])
    })

    // Try to start again — should be ignored
    act(() => {
      result.current.startMatching([makeFile('second.pdf', 'application/pdf')])
    })

    expect(matchingAdapter.ocr).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useMatching.test.tsx`
Expected: FAIL — `./useMatching` not found.

- [ ] **Step 3: Implement useMatching hook**

Create `src/hooks/useMatching.ts`:

```typescript
import { useState, useCallback, useRef, useMemo } from 'react'
import type { RowData, AttachmentAdapter } from '../types'
import type { MatchingAdapter, MatchedFile, UnmatchedFile } from '../matching-types'
import type { UseMatchingReturn } from '../matching-context'
import { filterByMimeType, fileToBase64, DEFAULT_ACCEPTED_TYPES } from '../lib/matching-utils'

type MatchingState = 'idle' | 'reading' | 'ocr' | 'matching' | 'duplicates' | 'reviewing' | 'attaching' | 'done' | 'error'

interface UseMatchingOptions<T extends RowData> {
  matchingAdapter: MatchingAdapter<T> | null
  attachmentAdapter: AttachmentAdapter | null
  data: T[]
  acceptedTypes?: string[]
}

export type { UseMatchingReturn }

export function useMatching<T extends RowData>(options: UseMatchingOptions<T>): UseMatchingReturn {
  const { matchingAdapter, attachmentAdapter, data, acceptedTypes = DEFAULT_ACCEPTED_TYPES } = options
  const enabled = matchingAdapter !== null && attachmentAdapter !== null

  const [state, setState] = useState<MatchingState>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState<{ phase: string; current: number; total: number } | null>(null)
  const [matches, setMatches] = useState<MatchedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UnmatchedFile[]>([])
  const [error, setError] = useState<string | undefined>()
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())
  const [bulkDropVisible, setBulkDropVisible] = useState(false)

  const abortedRef = useRef(false)
  const dragCounterRef = useRef(0)
  const fileDataRef = useRef<Map<string, { filename: string; mimeType: string; dataBase64: string }>>(new Map())

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
  }, [])

  const reset = useCallback(() => {
    abortedRef.current = true
    setState('idle')
    setLogs([])
    setProgress(null)
    setMatches([])
    setUnmatchedFiles([])
    setError(undefined)
    setSelectedMatches(new Set())
    setBulkDropVisible(false)
    fileDataRef.current = new Map()
  }, [])

  const startMatching = useCallback(async (files: File[]) => {
    if (!matchingAdapter || !attachmentAdapter || state !== 'idle') return

    abortedRef.current = false
    const validFiles = filterByMimeType(files, acceptedTypes)

    if (validFiles.length === 0) {
      addLog('No valid files to match')
      return
    }

    try {
      // Phase 1: Reading
      setState('reading')
      addLog(`Received ${validFiles.length} files for bulk matching`)
      setProgress({ phase: 'reading', current: 0, total: validFiles.length })

      const fileDataArray: Array<{ filename: string; mimeType: string; dataBase64: string }> = []
      const fileDataMap = new Map<string, { filename: string; mimeType: string; dataBase64: string }>()

      for (let i = 0; i < validFiles.length; i++) {
        if (abortedRef.current) return
        const file = validFiles[i]
        addLog(`Reading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
        const dataBase64 = await fileToBase64(file)
        const entry = { filename: file.name, mimeType: file.type, dataBase64 }
        fileDataArray.push(entry)
        fileDataMap.set(file.name, entry)
        setProgress({ phase: 'reading', current: i + 1, total: validFiles.length })
      }

      fileDataRef.current = fileDataMap

      // Phase 2: OCR
      if (abortedRef.current) return
      setState('ocr')
      addLog(`Starting OCR on ${fileDataArray.length} files...`)
      setProgress({ phase: 'ocr', current: 0, total: fileDataArray.length })

      const ocrResults = await matchingAdapter.ocr(fileDataArray)

      const successfulOcr = ocrResults.filter((r) => !r.error)
      for (const ocr of ocrResults) {
        if (ocr.error) {
          addLog(`OCR error for ${ocr.filename}: ${ocr.error}`)
        } else {
          const totalChars = ocr.pages.reduce((sum, p) => sum + p.text.length, 0)
          addLog(`OCR complete: ${ocr.filename} - ${ocr.pages.length} page(s), ${totalChars} chars`)
        }
      }

      if (successfulOcr.length === 0) {
        setState('error')
        setError('OCR failed for all files')
        addLog('OCR failed for all files')
        return
      }

      // Phase 3: Matching
      if (abortedRef.current) return
      setState('matching')
      const summaries = data.map((row) => matchingAdapter.summarize(row))
      addLog(`Matching ${successfulOcr.length} OCR results against ${summaries.length} transactions...`)
      setProgress({ phase: 'matching', current: 0, total: successfulOcr.length })

      const matchResult = await matchingAdapter.match(successfulOcr, summaries, (p) => {
        addLog(p.message)
        if (p.phase && p.current !== undefined && p.total !== undefined) {
          setProgress({ phase: p.phase, current: p.current, total: p.total })
        }
      })

      // Phase 4: Duplicate detection
      if (abortedRef.current) return
      setState('duplicates')
      addLog('Checking for duplicate attachments...')
      setProgress({ phase: 'duplicates', current: 0, total: matchResult.matches.length })

      const finalMatches: MatchedFile[] = []
      const finalUnmatched: UnmatchedFile[] = [...matchResult.unmatched_files]

      for (let i = 0; i < matchResult.matches.length; i++) {
        if (abortedRef.current) return
        const m = matchResult.matches[i]
        const existing = await attachmentAdapter.list(m.transaction_id)
        const isDuplicate = existing.some((a) => a.filename === m.filename)

        if (isDuplicate) {
          addLog(`  Skipped (duplicate): ${m.filename} already attached to ${m.transaction_id}`)
          finalUnmatched.push({
            file: m.file,
            filename: m.filename,
            reason: `Already imported - "${m.filename}" is already attached to this transaction`,
          })
        } else {
          addLog(`  Matched: ${m.filename} → ${m.transaction_id} (${m.confidence})`)
          finalMatches.push(m)
        }
        setProgress({ phase: 'duplicates', current: i + 1, total: matchResult.matches.length })
      }

      // Phase 5: Reviewing
      if (abortedRef.current) return
      setMatches(finalMatches)
      setUnmatchedFiles(finalUnmatched)
      setSelectedMatches(new Set(finalMatches.map((m) => m.filename)))
      setProgress(null)
      setState('reviewing')
      addLog(`Ready for review: ${finalMatches.length} matched, ${finalUnmatched.length} unmatched`)
    } catch (err) {
      if (abortedRef.current) return
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState('error')
      setError(message)
      addLog(`Error: ${message}`)
    }
  }, [matchingAdapter, attachmentAdapter, data, acceptedTypes, state, addLog])

  const toggleMatch = useCallback((filename: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }, [])

  const confirmMatches = useCallback(async () => {
    if (!attachmentAdapter) return

    setState('attaching')
    const toAttach = matches.filter((m) => selectedMatches.has(m.filename))
    addLog(`Attaching ${toAttach.length} files...`)
    setProgress({ phase: 'attaching', current: 0, total: toAttach.length })

    let attached = 0
    let failed = 0

    for (let i = 0; i < toAttach.length; i++) {
      const m = toAttach[i]
      const fileData = fileDataRef.current.get(m.filename)
      if (!fileData) {
        addLog(`  Error: file data not found for ${m.filename}`)
        failed++
        continue
      }

      try {
        await attachmentAdapter.add(m.transaction_id, m.filename, fileData.mimeType, fileData.dataBase64)
        addLog(`  Attached: ${m.filename} → ${m.transaction_id}`)
        attached++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        addLog(`  Failed to attach ${m.filename}: ${msg}`)
        failed++
      }
      setProgress({ phase: 'attaching', current: i + 1, total: toAttach.length })
    }

    addLog(`Done: ${attached} attached, ${failed} failed`)
    setProgress(null)
    setState('done')
  }, [attachmentAdapter, matches, selectedMatches, addLog])

  const getRowDropHandlers = useCallback((rowId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!attachmentAdapter) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDrop: async (e: React.DragEvent) => {
      if (!attachmentAdapter) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)
      const valid = filterByMimeType(files, acceptedTypes)
      if (valid.length !== 1) return // Row drops are single-file only

      const file = valid[0]
      const dataBase64 = await fileToBase64(file)
      await attachmentAdapter.add(rowId, file.name, file.type, dataBase64)
    },
  }), [attachmentAdapter, acceptedTypes])

  const dropHandlers = useMemo(() => ({
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (enabled && e.dataTransfer.items.length >= 2) {
        setBulkDropVisible(true)
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setBulkDropVisible(false)
      }
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setBulkDropVisible(false)
      if (!enabled) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length >= 2) {
        startMatching(files)
      }
    },
  }), [enabled, startMatching])

  return {
    state,
    logs,
    progress,
    matches,
    unmatchedFiles,
    error,
    selectedMatches,
    startMatching,
    toggleMatch,
    confirmMatches,
    reset,
    bulkDropVisible,
    dropHandlers,
    getRowDropHandlers,
    enabled,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useMatching.test.tsx`
Expected: All 10 tests PASS.

- [ ] **Step 5: Run full typecheck and test suite**

Run: `npm run typecheck && npm test`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMatching.ts src/hooks/useMatching.test.tsx
git commit -m "feat(matching): add useMatching hook with full state machine"
```

---

### Task 5: Presentational components — ConfidenceBadge and MatchingProgressBar

**Files:**
- Create: `src/components/matching/ConfidenceBadge.tsx`
- Create: `src/components/matching/MatchingProgressBar.tsx`

- [ ] **Step 1: Create ConfidenceBadge**

Create `src/components/matching/ConfidenceBadge.tsx`:

```tsx
import { cn } from '../../lib/utils'

const config = {
  high:   { bg: 'bg-dt-positive/10', text: 'text-dt-positive', label: 'High' },
  medium: { bg: 'bg-yellow-400/10',  text: 'text-yellow-400',  label: 'Medium' },
  low:    { bg: 'bg-dt-negative/10', text: 'text-dt-negative', label: 'Low' },
} as const

export function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const c = config[confidence]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', c.bg, c.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', confidence === 'high' ? 'bg-dt-positive' : confidence === 'medium' ? 'bg-yellow-400' : 'bg-dt-negative')} />
      {c.label}
    </span>
  )
}
```

- [ ] **Step 2: Create MatchingProgressBar**

Create `src/components/matching/MatchingProgressBar.tsx`:

```tsx
const phaseLabels: Record<string, string> = {
  reading: 'Reading files…',
  ocr: 'Running OCR…',
  matching: 'Matching…',
  duplicates: 'Checking duplicates…',
  attaching: 'Attaching files…',
}

export function MatchingProgressBar({ progress }: { progress: { phase: string; current: number; total: number } | null }) {
  if (!progress || progress.total === 0) return null

  const percentage = Math.round((progress.current / progress.total) * 100)
  const label = phaseLabels[progress.phase] ?? progress.phase

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-dt-muted">
        <span>{label}</span>
        <span>{progress.current}/{progress.total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-dt-border">
        <div
          className="h-full rounded-full bg-dt-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/matching/ConfidenceBadge.tsx src/components/matching/MatchingProgressBar.tsx
git commit -m "feat(matching): add ConfidenceBadge and MatchingProgressBar components"
```

---

### Task 6: BulkDropZone component

**Files:**
- Create: `src/components/matching/BulkDropZone.tsx`

- [ ] **Step 1: Create BulkDropZone**

Create `src/components/matching/BulkDropZone.tsx`:

```tsx
import { Paperclip } from 'lucide-react'
import { useMatchingContext } from '../../matching-context'

export function BulkDropZone() {
  const matching = useMatchingContext()
  if (!matching?.bulkDropVisible) return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-dt-bg/80 backdrop-blur-sm border-2 border-dashed border-dt-primary rounded-lg pointer-events-none">
      <div className="text-center">
        <Paperclip className="w-12 h-12 mx-auto mb-3 text-dt-primary" />
        <p className="text-lg font-medium text-dt-text">Drop files to bulk match</p>
        <p className="text-sm text-dt-muted mt-1">Files will be OCR&apos;d and matched to transactions</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/matching/BulkDropZone.tsx
git commit -m "feat(matching): add BulkDropZone overlay component"
```

---

### Task 7: MatchingReportContent and MatchingReportDialog

**Files:**
- Create: `src/components/matching/MatchingReportContent.tsx`
- Create: `src/components/matching/MatchingReportDialog.tsx`

- [ ] **Step 1: Create MatchingReportContent**

Create `src/components/matching/MatchingReportContent.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import { useMatchingContext } from '../../matching-context'
import { MatchingProgressBar } from './MatchingProgressBar'
import { ConfidenceBadge } from './ConfidenceBadge'

export function MatchingReportContent() {
  const matching = useMatchingContext()
  if (!matching) return null

  const { state, logs, progress, matches, unmatchedFiles, error, selectedMatches, toggleMatch, confirmMatches, reset } = matching
  const isProcessing = state === 'reading' || state === 'ocr' || state === 'matching' || state === 'duplicates'
  const selectedCount = matches.filter((m) => selectedMatches.has(m.filename)).length

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dt-border px-6 py-4">
        <h2 className="text-lg font-semibold text-dt-text">
          {isProcessing ? 'Matching files…' : state === 'attaching' ? 'Attaching files…' : state === 'error' ? 'Matching failed' : 'Matching results'}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Progress bar */}
        {(isProcessing || state === 'attaching') && <MatchingProgressBar progress={progress} />}

        {/* Error message */}
        {state === 'error' && error && (
          <div className="rounded-lg border border-dt-negative/30 bg-dt-negative/10 p-3 text-sm text-dt-negative">
            {error}
          </div>
        )}

        {/* Log panel */}
        {(isProcessing || state === 'attaching' || state === 'error') && <LogPanel logs={logs} />}

        {/* Matched files */}
        {state === 'reviewing' && matches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-dt-text mb-2">Matched files ({matches.length})</h3>
            <div className="space-y-2">
              {matches.map((m) => (
                <label key={m.filename} className="flex items-start gap-3 rounded-lg border border-dt-border p-3 cursor-pointer hover:bg-dt-bg-secondary">
                  <input
                    type="checkbox"
                    checked={selectedMatches.has(m.filename)}
                    onChange={() => toggleMatch(m.filename)}
                    className="mt-0.5 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dt-text truncate">{m.filename}</span>
                      <ConfidenceBadge confidence={m.confidence} />
                    </div>
                    <p className="text-xs text-dt-muted mt-0.5">→ {m.transaction_id}</p>
                    <p className="text-xs text-dt-muted">{m.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched files */}
        {state === 'reviewing' && unmatchedFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-dt-text mb-2">Unmatched files ({unmatchedFiles.length})</h3>
            <div className="space-y-2">
              {unmatchedFiles.map((u) => (
                <div key={u.filename} className="rounded-lg border border-dt-border p-3">
                  <span className="text-sm font-medium text-dt-text">{u.filename}</span>
                  <p className="text-xs text-dt-muted mt-0.5">{u.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviewing with 0 matches */}
        {state === 'reviewing' && matches.length === 0 && unmatchedFiles.length === 0 && (
          <p className="text-sm text-dt-muted">No matches or files to show.</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-dt-border px-6 py-4">
        {(isProcessing || state === 'error' || state === 'reviewing') && (
          <button
            onClick={reset}
            className="rounded-lg border border-dt-border px-4 py-2 text-sm text-dt-text hover:bg-dt-bg-secondary"
          >
            {state === 'error' ? 'Close' : 'Cancel'}
          </button>
        )}
        {state === 'reviewing' && selectedCount > 0 && (
          <button
            onClick={confirmMatches}
            className="rounded-lg bg-dt-primary px-4 py-2 text-sm font-medium text-white hover:bg-dt-primary-hover"
          >
            Confirm {selectedCount} {selectedCount === 1 ? 'match' : 'matches'}
          </button>
        )}
      </div>
    </div>
  )
}

function LogPanel({ logs }: { logs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div ref={scrollRef} className="max-h-48 overflow-y-auto rounded-lg border border-dt-border bg-dt-bg-secondary p-3 font-mono text-xs text-dt-muted">
      {logs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create MatchingReportDialog**

Create `src/components/matching/MatchingReportDialog.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { useMatchingContext } from '../../matching-context'
import { MatchingReportContent } from './MatchingReportContent'

interface MatchingReportDialogProps {
  wrapper?: (props: { open: boolean; onClose: () => void; children: ReactNode }) => ReactNode
}

export function MatchingReportDialog({ wrapper }: MatchingReportDialogProps) {
  const matching = useMatchingContext()
  if (!matching) return null

  const isOpen = matching.state !== 'idle' && matching.state !== 'done'
  const content = <MatchingReportContent />

  if (wrapper) {
    return <>{wrapper({ open: isOpen, onClose: matching.reset, children: content })}</>
  }

  if (!isOpen) return null

  return <BuiltInModal onClose={matching.reset}>{content}</BuiltInModal>
}

function BuiltInModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus trap — focus the panel on mount
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-50 w-full max-w-3xl overflow-hidden rounded-lg border border-dt-border bg-dt-bg shadow-xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/matching/MatchingReportContent.tsx src/components/matching/MatchingReportDialog.tsx
git commit -m "feat(matching): add MatchingReportContent and MatchingReportDialog"
```

---

### Task 8: MatchingDataTable wrapper

**Files:**
- Create: `src/components/matching/MatchingDataTable.tsx`

- [ ] **Step 1: Create MatchingDataTable**

Create `src/components/matching/MatchingDataTable.tsx`:

```tsx
import { type ReactNode } from 'react'
import type { RowData, DataTableProps, AttachmentAdapter } from '../../types'
import type { MatchingAdapter } from '../../matching-types'
import { DataTable } from '../DataTable'
import { MatchingProvider } from '../../matching-context'
import { useMatching } from '../../hooks/useMatching'
import { BulkDropZone } from './BulkDropZone'
import { MatchingReportDialog } from './MatchingReportDialog'
import { cn } from '../../lib/utils'

interface MatchingDataTableProps<T extends RowData> extends DataTableProps<T> {
  matchingAdapter?: MatchingAdapter<T>
  attachmentAdapter?: AttachmentAdapter
  matchingAcceptedTypes?: string[]
  matchingDialogWrapper?: (props: { open: boolean; onClose: () => void; children: ReactNode }) => ReactNode
}

export function MatchingDataTable<T extends RowData>({
  matchingAdapter,
  attachmentAdapter,
  matchingAcceptedTypes,
  matchingDialogWrapper,
  className,
  ...dataTableProps
}: MatchingDataTableProps<T>) {
  const matching = useMatching({
    matchingAdapter: matchingAdapter ?? null,
    attachmentAdapter: attachmentAdapter ?? null,
    data: dataTableProps.data,
    acceptedTypes: matchingAcceptedTypes,
  })

  return (
    <MatchingProvider value={matching}>
      <div className={cn('relative', className)} {...matching.dropHandlers}>
        <DataTable {...dataTableProps} attachmentAdapter={attachmentAdapter} />
        <BulkDropZone />
        <MatchingReportDialog wrapper={matchingDialogWrapper} />
      </div>
    </MatchingProvider>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/matching/MatchingDataTable.tsx
git commit -m "feat(matching): add MatchingDataTable drop-in wrapper"
```

---

### Task 9: Entry point, build config, and package exports

**Files:**
- Create: `src/matching.ts`
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the matching entry point**

Create `src/matching.ts`:

```typescript
// Types
export type {
  OcrResult,
  MatchedFile,
  UnmatchedFile,
  MatchResult,
  TransactionSummary,
  MatchingProgress,
  MatchingAdapter,
} from './matching-types'

// Hook
export { useMatching } from './hooks/useMatching'
export type { UseMatchingReturn } from './matching-context'

// Context
export { MatchingProvider, useMatchingContext } from './matching-context'

// Components
export { MatchingDataTable } from './components/matching/MatchingDataTable'
export { BulkDropZone } from './components/matching/BulkDropZone'
export { MatchingReportContent } from './components/matching/MatchingReportContent'
export { MatchingReportDialog } from './components/matching/MatchingReportDialog'
export { ConfidenceBadge } from './components/matching/ConfidenceBadge'
export { MatchingProgressBar } from './components/matching/MatchingProgressBar'

// Utilities
export { fileToBase64, filterByMimeType, DEFAULT_ACCEPTED_TYPES } from './lib/matching-utils'
```

- [ ] **Step 2: Add entry point to tsup.config.ts**

Replace the full `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'tailwindcss'],
    treeshake: true,
  },
  {
    entry: ['src/tailwind.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    external: ['tailwindcss'],
  },
  {
    entry: ['src/matching.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-dom', 'tailwindcss'],
    treeshake: true,
  },
])
```

- [ ] **Step 3: Add `./matching` export to package.json**

In `package.json`, add the `"./matching"` entry to the `"exports"` field, after the `"./tailwind"` entry:

```jsonc
    "./matching": {
      "types": "./dist/matching.d.ts",
      "import": "./dist/matching.js",
      "require": "./dist/matching.cjs"
    },
```

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS — produces `dist/matching.js`, `dist/matching.cjs`, `dist/matching.d.ts` alongside existing outputs.

- [ ] **Step 5: Verify dist output**

Run: `ls dist/matching*`
Expected:
```
dist/matching.cjs
dist/matching.d.ts
dist/matching.js
```

- [ ] **Step 6: Run full typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/matching.ts tsup.config.ts package.json
git commit -m "feat(matching): add /matching entry point, build config, and package exports"
```

---

### Task 10: Component tests

**Files:**
- Create: `src/components/matching/matching-components.test.tsx`

- [ ] **Step 1: Write component tests**

Create `src/components/matching/matching-components.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchingProvider, type UseMatchingReturn } from '../../matching-context'
import { ConfidenceBadge } from './ConfidenceBadge'
import { BulkDropZone } from './BulkDropZone'
import { MatchingReportDialog } from './MatchingReportDialog'
import { MatchingReportContent } from './MatchingReportContent'

// Helper to create a mock matching context value
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
    expect(screen.getByText('Running OCR…')).toBeInTheDocument()
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
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/components/matching/matching-components.test.tsx`
Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/matching/matching-components.test.tsx
git commit -m "test(matching): add component tests for matching UI"
```

---

### Task 11: Final verification and lint

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: PASS — all three entry points compile.

- [ ] **Step 2: Verify matching dist output**

Run: `ls -la dist/matching*`
Expected: `matching.js`, `matching.cjs`, `matching.d.ts` exist.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 6: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore(matching): lint fixes"
```

Only if lint produced fixable issues. Skip if clean.
