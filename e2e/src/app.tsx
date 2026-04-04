import React from 'react'
import { createRoot } from 'react-dom/client'
import { DataTable, defineTable } from '../../dist/index.js'
import transactions from './data.json'

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

function App() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{
        padding: '12px 16px',
        margin: 0,
        fontSize: '16px',
        color: 'var(--dt-text, #f3f4f6)',
        background: 'var(--dt-bg, #1a1a2e)',
        borderBottom: '1px solid var(--dt-border, #374151)',
      }}>
        Bank Transactions — 10,000 records
      </h1>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable
          {...table}
          data={transactions as Transaction[]}
          preset="full"
        />
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
