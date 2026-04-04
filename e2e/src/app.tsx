import React, { useState, useMemo, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { DataTable, defineTable } from '../../dist/index.js'
import { useMatching, MatchingProvider, useMatchingContext, BulkDropZone, MatchingReportDialog } from '../../dist/matching.js'
import type { AttachmentAdapter, Attachment } from '../../dist/index.js'
import type { MatchingAdapter, OcrResult, MatchResult } from '../../dist/matching.js'
import allTransactions from './data.json'

// --- Types ---

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  mccCode: string
  mccCategory: string
  status: 'settled' | 'pending' | 'declined'
  cardLast4: string
}

// --- Demo delay control ---
// E2E mode: delays = 0 for fast assertions. Manual mode: realistic timing.
declare global {
  interface Window { __E2E_MODE__?: boolean }
}
const DEMO_DELAY = () => window.__E2E_MODE__ ? 0 : 1500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Mock Attachment Adapter ---

function createMockAttachmentAdapter(): AttachmentAdapter {
  const store = new Map<string, Attachment[]>()

  return {
    async add(rowId, filename, mimeType, _dataBase64) {
      const attachment: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        filename,
        mimeType,
        createdAt: new Date().toISOString(),
      }
      const existing = store.get(rowId) || []
      existing.push(attachment)
      store.set(rowId, existing)
      return attachment
    },
    async list(rowId) {
      return store.get(rowId) || []
    },
    async delete(attachmentId) {
      for (const [, attachments] of store) {
        const idx = attachments.findIndex((a) => a.id === attachmentId)
        if (idx !== -1) {
          attachments.splice(idx, 1)
          return
        }
      }
    },
    async getCounts(rowIds) {
      const counts: Record<string, number> = {}
      for (const id of rowIds) {
        const list = store.get(id)
        if (list && list.length > 0) counts[id] = list.length
      }
      return counts
    },
  }
}

// --- Mock Matching Adapter ---

function createMockMatchingAdapter(): MatchingAdapter<Transaction> {
  return {
    async ocr(files) {
      await sleep(DEMO_DELAY())
      return files.map((f): OcrResult => ({
        file: f.dataBase64,
        filename: f.filename,
        pages: [
          { page: 1, text: `Invoice from merchant\nAmount: $150.00\nDate: 2024-03-15\nRef: ${f.filename}` },
        ],
      }))
    },

    async match(ocrResults, transactions, onProgress) {
      const delay = DEMO_DELAY()

      onProgress({ message: 'Starting matching session...', phase: 'matching', current: 0, total: ocrResults.length })
      await sleep(delay)

      const matches: MatchResult['matches'] = []
      const unmatched: MatchResult['unmatched_files'] = []

      for (let i = 0; i < ocrResults.length; i++) {
        const ocr = ocrResults[i]
        onProgress({
          message: `Processing ${ocr.filename}...`,
          phase: 'matching',
          current: i + 1,
          total: ocrResults.length,
        })
        await sleep(delay / 2)

        // Match first N-1 files to transactions, leave last one unmatched
        if (i < ocrResults.length - 1 && i < transactions.length) {
          const txn = transactions[i]
          const confidence = i === 0 ? 'high' : i === 1 ? 'medium' : 'low'
          matches.push({
            file: ocr.file,
            filename: ocr.filename,
            transaction_id: txn.id,
            confidence: confidence as 'high' | 'medium' | 'low',
            reason: `Amount $${txn.amount} matches invoice total. Merchant "${txn.description}" found in OCR text.`,
          })
          onProgress({ message: `  → ${ocr.filename} matched to ${txn.id} (${confidence})` })
        } else {
          unmatched.push({
            file: ocr.file,
            filename: ocr.filename,
            reason: 'No matching transaction found — amount and date do not correspond to any record.',
          })
          onProgress({ message: `  → ${ocr.filename} — no match found` })
        }
      }

      onProgress({ message: `Matching complete: ${matches.length} matched, ${unmatched.length} unmatched` })
      return { matches, unmatched_files: unmatched }
    },

    summarize(row) {
      return {
        id: row.id,
        date: row.date,
        amount: row.amount,
        currency: 'USD',
        description: [row.merchant, row.mccCategory, row.status].filter(Boolean).join(' - '),
      }
    },
  }
}

// --- Table definition ---

const table = defineTable<Transaction>({
  rowKey: 'id',
  storageKey: 'bank-transactions',
  columns: {
    date: { label: 'Date', type: 'date', datePeriods: ['month', 'quarter'] },
    merchant: { label: 'Merchant', type: 'text' },
    amount: { label: 'Amount', type: 'currency', currency: 'USD', sumInGroup: true },
    mccCode: { label: 'MCC', type: 'text', visible: false },
    mccCategory: { label: 'Category', type: 'text', groupable: true },
    status: { label: 'Status', type: 'text', groupable: true },
    cardLast4: { label: 'Card', type: 'text' },
  },
  defaults: {
    sort: { field: 'date', direction: 'desc' },
    groupBy: [{ field: 'mccCategory', sort: 'asc' }],
  },
})

// --- App ---

type PaginationMode = 'paginated' | 'infinite'
const PAGE_SIZE = 100
const allData = allTransactions as Transaction[]

function App() {
  const [mode, setMode] = useState<PaginationMode>('paginated')
  const [page, setPage] = useState(0)
  const [infiniteCount, setInfiniteCount] = useState(PAGE_SIZE)

  const attachmentAdapter = useMemo(() => createMockAttachmentAdapter(), [])
  const matchingAdapter = useMemo(() => createMockMatchingAdapter(), [])

  const visibleData = useMemo(() => {
    if (mode === 'paginated') {
      const start = page * PAGE_SIZE
      return allData.slice(start, start + PAGE_SIZE)
    }
    return allData.slice(0, infiniteCount)
  }, [mode, page, infiniteCount])

  const totalRecords = allData.length
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)

  const matching = useMatching({
    matchingAdapter,
    attachmentAdapter,
    data: visibleData,
  })

  const switchMode = useCallback((newMode: PaginationMode) => {
    setMode(newMode)
    setPage(0)
    setInfiniteCount(PAGE_SIZE)
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (mode !== 'infinite') return
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300
    if (nearBottom && infiniteCount < totalRecords) {
      setInfiniteCount(prev => Math.min(prev + PAGE_SIZE, totalRecords))
    }
  }, [mode, infiniteCount, totalRecords])

  const start = page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, totalRecords)

  return (
    <MatchingProvider value={matching}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--dt-bg, #ffffff)' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--dt-border, #e5e7eb)',
          background: 'var(--dt-bg, #ffffff)',
          flexShrink: 0,
        }}>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--dt-text, #111827)' }}>
            Bank Transactions — {totalRecords.toLocaleString()} records
          </h1>
          <div style={{ display: 'flex', gap: '4px' }}>
            <DemoBulkMatchButton />
            {(['paginated', 'infinite'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  padding: '5px 14px',
                  border: '1px solid var(--dt-border, #e5e7eb)',
                  borderRadius: '4px',
                  background: mode === m ? 'var(--dt-primary, #3b82f6)' : 'var(--dt-bg-secondary, #f9fafb)',
                  color: mode === m ? '#fff' : 'var(--dt-muted, #6b7280)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {m === 'paginated' ? 'Paginated' : 'Infinite Scroll'}
              </button>
            ))}
          </div>
        </div>

        {/* Table area — scrollable, with drop zone */}
        <div
          style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
          onScroll={handleScroll}
          {...matching.dropHandlers}
        >
          <DataTable
            {...table}
            data={visibleData}
            preset="full"
            attachmentAdapter={attachmentAdapter}
          />
          <BulkDropZone />
        </div>

        {/* Pagination controls (only in paginated mode) */}
        {mode === 'paginated' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '8px 16px',
            borderTop: '1px solid var(--dt-border, #e5e7eb)',
            background: 'var(--dt-bg, #ffffff)',
            fontSize: '13px',
            color: 'var(--dt-muted, #6b7280)',
            flexShrink: 0,
          }}>
          <NavButton onClick={() => setPage(0)} disabled={page === 0}>««</NavButton>
          <NavButton onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</NavButton>
          <span>
            Page <strong style={{ color: 'var(--dt-text, #111827)' }}>{page + 1}</strong> of {totalPages}
            {' '}({start + 1}–{end} of {totalRecords.toLocaleString()})
          </span>
          <NavButton onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next ›</NavButton>
          <NavButton onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»»</NavButton>
          </div>
        )}

        {/* Infinite scroll indicator */}
        {mode === 'infinite' && infiniteCount < totalRecords && (
          <div style={{
            textAlign: 'center',
            padding: '8px',
            color: 'var(--dt-muted, #6b7280)',
            fontSize: '12px',
            borderTop: '1px solid var(--dt-border, #e5e7eb)',
            flexShrink: 0,
          }}>
            Showing {infiniteCount.toLocaleString()} of {totalRecords.toLocaleString()} — scroll for more
          </div>
        )}

        {/* Matching dialog (renders as portal-like fixed overlay) */}
        <MatchingReportDialog />
      </div>
    </MatchingProvider>
  )
}

/** Button that triggers the matching flow with fake files for demo/testing */
function DemoBulkMatchButton() {
  const matching = useMatchingContext()
  if (!matching?.enabled) return null

  const handleClick = () => {
    if (matching.state !== 'idle') return
    const fakeFiles = [
      new File(['fake-pdf-content-1'], 'invoice-march.pdf', { type: 'application/pdf' }),
      new File(['fake-pdf-content-2'], 'receipt-april.pdf', { type: 'application/pdf' }),
      new File(['fake-png-content'], 'scan-may.png', { type: 'image/png' }),
    ]
    matching.startMatching(fakeFiles)
  }

  return (
    <button
      id="demo-bulk-match"
      onClick={handleClick}
      disabled={matching.state !== 'idle'}
      style={{
        padding: '5px 14px',
        border: '1px solid var(--dt-border, #e5e7eb)',
        borderRadius: '4px',
        background: 'var(--dt-bg-secondary, #f9fafb)',
        color: matching.state !== 'idle' ? 'var(--dt-border, #e5e7eb)' : 'var(--dt-primary, #3b82f6)',
        cursor: matching.state !== 'idle' ? 'default' : 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        opacity: matching.state !== 'idle' ? 0.5 : 1,
      }}
    >
      Demo Bulk Match
    </button>
  )
}

function NavButton({ onClick, disabled, children }: { onClick: () => void, disabled: boolean, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        border: '1px solid var(--dt-border, #e5e7eb)',
        borderRadius: '4px',
        background: 'var(--dt-bg-secondary, #f9fafb)',
        color: disabled ? 'var(--dt-border, #e5e7eb)' : 'var(--dt-text, #111827)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '13px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
