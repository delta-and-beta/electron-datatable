import React, { useState, useMemo, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { DataTable, defineTable } from '../../dist/index.js'
import allTransactions from './data.json'

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

type PaginationMode = 'paginated' | 'infinite'
const PAGE_SIZE = 100
const allData = allTransactions as Transaction[]

function App() {
  const [mode, setMode] = useState<PaginationMode>('paginated')
  const [page, setPage] = useState(0)
  const [infiniteCount, setInfiniteCount] = useState(PAGE_SIZE)

  // Paginated: slice the data to current page
  // Infinite: slice to current visible count
  // Both pass a subset to DataTable so the DOM stays small
  const visibleData = useMemo(() => {
    if (mode === 'paginated') {
      const start = page * PAGE_SIZE
      return allData.slice(start, start + PAGE_SIZE)
    }
    return allData.slice(0, infiniteCount)
  }, [mode, page, infiniteCount])

  const totalRecords = allData.length
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)

  // Reset page/count when switching modes
  const switchMode = useCallback((newMode: PaginationMode) => {
    setMode(newMode)
    setPage(0)
    setInfiniteCount(PAGE_SIZE)
  }, [])

  // Infinite scroll handler — attached to the scroll container
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

      {/* Table area — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} onScroll={handleScroll}>
        <DataTable
          {...table}
          data={visibleData}
          preset="full"
        />
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
    </div>
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
