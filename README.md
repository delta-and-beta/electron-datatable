<div align="center">
  <br />
  <h1>electron-datatable</h1>
  <p><strong>A composable React data table with multi-level grouping, filtering, search, sorting, and column management.</strong></p>
  <p>Styled with Tailwind CSS. Themed via CSS custom properties. Fully type-safe.</p>

  <br />

  [![npm](https://img.shields.io/npm/v/@delta-and-beta/electron-datatable?color=3b82f6&label=npm&style=flat-square)](https://www.npmjs.com/package/@delta-and-beta/electron-datatable)
  [![license](https://img.shields.io/github/license/delta-and-beta/electron-datatable?color=22c55e&style=flat-square)](./LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18+-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
  [![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3+-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

  <br />
</div>

---

## Highlights

| | |
|---|---|
| **Multi-level grouping** | Group by any column, nest groups, bucket dates by month / quarter / year |
| **Smart filtering** | Nested AND/OR condition groups with type-aware operators |
| **Full-text search** | Debounced, case-insensitive search across all text columns |
| **Sorting** | Locale-aware, null-last semantics, click-to-toggle |
| **Column management** | Toggle visibility, reorder columns at runtime |
| **Auto-aggregation** | Number & currency columns summed in group headers automatically |
| **State persistence** | Sort, filter, grouping, and column state saved to `localStorage` |
| **Compound components** | Use presets for zero-config, or compose your own layout |
| **Theming** | `dt-*` design tokens via CSS custom properties, dark & light included |
| **Bulk file matching** | Drop files → OCR → match → confirm → attach, with adapter pattern |
| **Type-safe** | Generic `defineTable<T>()` with full IntelliSense on column IDs |
| **Tree-shakeable** | Every hook and pure function importable independently |

---

## Quick Start

### 1. Install

```bash
npm install @delta-and-beta/electron-datatable
```

> Peer dependencies: `react >= 18`, `react-dom >= 18`, `tailwindcss >= 3`

### 2. Configure Tailwind

```ts
// tailwind.config.ts
import { dataTablePreset } from '@delta-and-beta/electron-datatable/tailwind'

export default {
  presets: [dataTablePreset],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@delta-and-beta/electron-datatable/dist/**/*.js',
  ],
}
```

### 3. Import styles and a theme

```tsx
import '@delta-and-beta/electron-datatable/styles.css'
import '@delta-and-beta/electron-datatable/themes/dark.css'   // or themes/light.css
```

### 4. Define and render your table

```tsx
import { DataTable, defineTable } from '@delta-and-beta/electron-datatable'

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  category: string
  status: 'settled' | 'pending' | 'declined'
}

const table = defineTable<Transaction>({
  rowKey: 'id',
  storageKey: 'transactions',
  columns: {
    date:     { label: 'Date',     type: 'date', datePeriods: ['month', 'quarter'] },
    merchant: { label: 'Merchant', type: 'text' },
    amount:   { label: 'Amount',   type: 'currency', currency: 'USD' },
    category: { label: 'Category', type: 'text', groupable: true },
    status:   { label: 'Status',   type: 'text', groupable: true },
  },
  defaults: {
    sort: { field: 'date', direction: 'desc' },
  },
})

function App() {
  return <DataTable {...table} data={transactions} preset="full" />
}
```

That's it. You get search, filtering, grouping, column toggle, and sorting out of the box.

---

## Presets

| Preset | What renders | Use case |
|--------|-------------|----------|
| `"full"` | Toolbar (search + filter + group-by + column toggle) + table + footer | Drop in and go |
| `"minimal"` | Table + footer | When you provide your own toolbar |
| `"none"` | Nothing &mdash; you compose with `children` | Full layout control |

```tsx
// Full — zero config
<DataTable {...table} data={data} preset="full" />

// Minimal — content only
<DataTable {...table} data={data} preset="minimal" />

// Custom — compose your own layout
<DataTable {...table} data={data}>
  <DataTable.Toolbar>
    <DataTable.Search className="w-80" />
    <DataTable.ColumnToggle />
  </DataTable.Toolbar>
  <DataTable.Content stickyHeader onRowClick={(row) => console.log(row)} />
  <DataTable.Footer />
</DataTable>
```

---

## Theming

All colors flow through CSS custom properties. Override them globally or scope them per table.

### Tokens

| Token | Dark | Light | Purpose |
|-------|------|-------|---------|
| `--dt-primary` | `#3b82f6` | `#3b82f6` | Buttons, active states |
| `--dt-primary-hover` | `#2563eb` | `#2563eb` | Hover states |
| `--dt-bg` | `#1a1a2e` | `#ffffff` | Table background |
| `--dt-bg-secondary` | `#16213e` | `#f9fafb` | Alternating rows, panels |
| `--dt-border` | `#374151` | `#e5e7eb` | Borders, dividers |
| `--dt-text` | `#f3f4f6` | `#111827` | Primary text |
| `--dt-muted` | `#9ca3af` | `#6b7280` | Secondary text, placeholders |
| `--dt-positive` | `#22c55e` | `#16a34a` | Positive values |
| `--dt-negative` | `#ef4444` | `#dc2626` | Negative values |

### Using your own design system

Skip the theme files and map your existing tokens:

```css
:root {
  --dt-primary: var(--color-primary);
  --dt-bg: var(--color-bg);
  --dt-text: var(--color-text);
  /* ... */
}
```

### Scoped themes

Apply different themes to different tables:

```css
.invoices-table { --dt-primary: #8b5cf6; --dt-bg: #0f172a; }
.orders-table   { --dt-primary: #06b6d4; --dt-bg: #1e1b4b; }
```

```tsx
<DataTable {...invoiceTable} data={invoices} preset="full" className="invoices-table" />
<DataTable {...orderTable}   data={orders}   preset="full" className="orders-table" />
```

---

## Column Types & Operators

| Type | Searchable | Auto-sum | Filter operators |
|------|:----------:|:--------:|------------------|
| `text` | yes | &mdash; | is, is not, contains, does not contain, is empty, is not empty |
| `number` | &mdash; | yes | =, !=, >, <, >=, <=, is empty, is not empty |
| `currency` | &mdash; | yes | Same as number |
| `date` | &mdash; | &mdash; | is, is before, is after, is on or before, is on or after, is empty, is not empty |
| `custom` | &mdash; | &mdash; | Use `render` and `format` for display |

All behavior flags (`sortable`, `searchable`, `groupable`, `visible`, `filterable`) default to `true` and can be overridden per column.

---

## Sub-Components

When using `preset="none"`, compose your layout with:

| Component | Description |
|-----------|-------------|
| `DataTable.Toolbar` | Flex container for toolbar items |
| `DataTable.Search` | Search input with debounce |
| `DataTable.Filter` | Filter toolbar button (badge shows active count) |
| `DataTable.FilterPanel` | Filter condition builder panel |
| `DataTable.GroupBy` | Group-by toolbar button |
| `DataTable.GroupByPanel` | Group-by configuration panel |
| `DataTable.ColumnToggle` | Column visibility dropdown |
| `DataTable.DateFilter` | Date range filter |
| `DataTable.Content` | Table body with rows, groups, and headers |
| `DataTable.Footer` | Row count footer |
| `DataTable.GroupHeader` | Custom group header renderer |

---

## Standalone Hooks

Each data pipeline hook is independently importable for building custom table UIs:

```tsx
import { useFilter, useSearch, useSort, useGroupBy, useColumns } from '@delta-and-beta/electron-datatable'

function CustomTable({ data, columns }) {
  const filter   = useFilter({ data, columns, storageKey: 'my-table' })
  const search   = useSearch({ data: filter.filteredData, columns })
  const sort     = useSort({ data: search.filteredData, storageKey: 'my-table' })
  const columns_ = useColumns({ columns, storageKey: 'my-table' })
  const groupBy  = useGroupBy({
    data: sort.sortedData,
    columns,
    sumFields: ['amount'],
    storageKey: 'my-table',
  })

  // Build your own UI from groupBy.groupedData, columns_.visibleColumns, etc.
}
```

The hooks must be called in pipeline order: **filter -> search -> sort -> groupBy**. Each hook's output feeds into the next.

Access full table state from any child component via context:

```tsx
import { useDataTable } from '@delta-and-beta/electron-datatable'

function StatusBar() {
  const { filteredData, groupBy } = useDataTable()
  return <div>{filteredData.length} records, {groupBy.levels.length} groups</div>
}
```

---

## API Reference

### `defineTable<T>(config)`

```ts
defineTable<Transaction>({
  rowKey: 'id',                    // keyof T & string — unique row identifier
  storageKey: 'transactions',      // localStorage key prefix
  columns: {                       // object-keyed, IDs inferred from keys
    date: { label: 'Date', type: 'date' },
    amount: { label: 'Amount', type: 'currency', currency: 'USD' },
  },
  defaults: {
    sort: { field: 'date', direction: 'desc' },
    groupBy: [{ field: 'category', sort: 'asc' }],
  },
})
```

Returns `{ columns, rowKey, storageKey, defaultSort, defaultGroupBy }` — spread directly onto `<DataTable>`.

### `ColumnDef<T>`

```ts
{
  id: string                          // Column identifier (matches data field)
  label: string                       // Header text
  type: 'text' | 'number' | 'date' | 'currency' | 'custom'

  // Display
  render?: (value: unknown, row: T) => ReactNode
  headerRender?: () => ReactNode
  width?: string                      // e.g. '200px', '20%'
  align?: 'left' | 'center' | 'right'

  // Behavior (all default to true)
  sortable?: boolean
  groupable?: boolean
  searchable?: boolean
  visible?: boolean
  filterable?: boolean

  // Grouping
  datePeriods?: ('day' | 'week' | 'month' | 'quarter' | 'year')[]
  sumInGroup?: boolean                // true by default for number/currency

  // Formatting
  format?: (value: unknown) => string
  currency?: string                   // ISO 4217 (e.g. 'USD', 'EUR')
}
```

### `DataTableProps<T>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Row data |
| `columns` | `ColumnDef<T>[]` | required | Column definitions |
| `rowKey` | `keyof T & string` | required | Unique identifier field |
| `storageKey` | `string` | `'dt'` | localStorage key prefix |
| `preset` | `'full' \| 'minimal' \| 'none'` | `'none'` | Render mode |
| `defaultSort` | `{ field, direction }` | &mdash; | Initial sort (overridden by saved state) |
| `defaultGroupBy` | `GroupLevel[]` | &mdash; | Initial grouping (overridden by saved state) |
| `onRowClick` | `(row: T) => void` | &mdash; | Row click handler |
| `onRowContextMenu` | `(row: T, event) => void` | &mdash; | Row right-click handler |
| `attachmentAdapter` | `AttachmentAdapter` | &mdash; | File attachment backend |
| `className` | `string` | &mdash; | Root element class |

### `AttachmentAdapter`

```ts
interface AttachmentAdapter {
  add(rowId: string, filename: string, mimeType: string, dataBase64: string): Promise<Attachment>
  list(rowId: string): Promise<Attachment[]>
  delete(attachmentId: string): Promise<void>
  getCounts(rowIds: string[]): Promise<Record<string, number>>
}
```

---

## Bulk File Matching

The `/matching` entry point adds OCR-based file matching as a composable layer on top of DataTable. Consumers provide a `MatchingAdapter` and the package handles the entire flow.

### Install

The matching module ships in the same package — just import from the `/matching` path:

```tsx
import { MatchingDataTable } from '@delta-and-beta/electron-datatable/matching'
```

### Zero-config usage

```tsx
import { defineTable } from '@delta-and-beta/electron-datatable'
import { MatchingDataTable } from '@delta-and-beta/electron-datatable/matching'

const matchingAdapter = {
  ocr: (files) => myOcrService.process(files),
  match: (ocrResults, transactions, onProgress) => myMatcher.match(ocrResults, transactions, onProgress),
  summarize: (row) => ({
    id: row.id,
    date: row.date,
    amount: row.amount,
    currency: 'USD',
    description: row.merchant,
  }),
}

<MatchingDataTable
  {...table}
  data={data}
  preset="full"
  attachmentAdapter={attachmentAdapter}
  matchingAdapter={matchingAdapter}
/>
```

When users drop 2+ files onto the table, the matching flow runs automatically:
1. Files are read and filtered by MIME type (PDF, PNG, JPEG, GIF by default)
2. OCR is called via `matchingAdapter.ocr()`
3. Results are matched against transactions via `matchingAdapter.match()`
4. Duplicates are detected against existing attachments
5. A report dialog shows matches (with confidence badges) and unmatched files
6. User confirms, and files are attached via `attachmentAdapter.add()`

Single-file drops go directly to `attachmentAdapter.add()` (no OCR/matching).

### With shadcn Dialog

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'

<MatchingDataTable
  {...table}
  data={data}
  preset="full"
  attachmentAdapter={attachmentAdapter}
  matchingAdapter={matchingAdapter}
  matchingDialogWrapper={({ open, onClose, children }) => (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        {children}
      </DialogContent>
    </Dialog>
  )}
/>
```

### Manual composition

```tsx
import { DataTable } from '@delta-and-beta/electron-datatable'
import { useMatching, MatchingProvider, BulkDropZone, MatchingReportDialog } from '@delta-and-beta/electron-datatable/matching'

function MyTable({ data }) {
  const matching = useMatching({ matchingAdapter, attachmentAdapter, data })

  return (
    <MatchingProvider value={matching}>
      <div className="relative" {...matching.dropHandlers}>
        <DataTable {...table} data={data} preset="full" />
        <BulkDropZone />
        <MatchingReportDialog />
      </div>
    </MatchingProvider>
  )
}
```

### `MatchingAdapter<T>`

```ts
interface MatchingAdapter<T> {
  ocr(files: Array<{ filename: string; mimeType: string; dataBase64: string }>): Promise<OcrResult[]>
  match(
    ocrResults: OcrResult[],
    transactions: TransactionSummary[],
    onProgress: (progress: MatchingProgress) => void,
  ): Promise<MatchResult>
  summarize(row: T): TransactionSummary
}
```

---

## License

MIT
