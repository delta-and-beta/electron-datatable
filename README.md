# @delta-and-beta/data-table

A composable React data table with multi-level grouping, search, sorting, filtering, and column management. Styled with Tailwind CSS, themed via CSS custom properties.

## Quick Start

```bash
npm install @delta-and-beta/data-table
```

```tsx
import '@delta-and-beta/data-table/styles.css'
import '@delta-and-beta/data-table/themes/dark.css' // or bring your own tokens
import { DataTable, defineTable } from '@delta-and-beta/data-table'

const table = defineTable<Invoice>({
  rowKey: 'id',
  columns: {
    vendor: { label: 'Vendor', type: 'text' },
    amount: { label: 'Amount', type: 'currency', currency: 'USD' },
    date:   { label: 'Date', type: 'date' },
  },
})

<DataTable {...table} data={invoices} preset="full" />
```

## Installation

### 1. Install the package

```bash
npm install @delta-and-beta/data-table
```

Peer dependencies: `react >=18`, `react-dom >=18`, `tailwindcss >=3`.

### 2. Import styles

**If your app has an existing design system** (recommended):

```tsx
import '@delta-and-beta/data-table/styles.css'
```

Then map your tokens to `dt-*` variables:

```css
:root {
  --dt-primary: var(--color-primary);
  --dt-primary-hover: var(--color-primary-hover);
  --dt-bg: var(--color-bg);
  --dt-bg-secondary: var(--color-bg-secondary);
  --dt-border: var(--color-border);
  --dt-text: var(--color-text);
  --dt-muted: var(--color-text-muted);
  --dt-positive: var(--color-success);
  --dt-negative: var(--color-error);
}
```

**If you don't have a design system** (quick start):

```tsx
import '@delta-and-beta/data-table/styles.css'
import '@delta-and-beta/data-table/themes/dark.css'  // or themes/light.css
```

**Alternative: Tailwind preset** (for teams that prefer native Tailwind integration):

```ts
// tailwind.config.ts
import { dataTablePreset } from '@delta-and-beta/data-table/tailwind'

export default {
  presets: [dataTablePreset],
  // ...
}
```

## Defining Tables

### `defineTable()` — config object (recommended)

Column IDs are type-checked against your data shape. Returns props that spread directly onto `<DataTable>`.

```tsx
import { defineTable } from '@delta-and-beta/data-table'

interface Invoice {
  id: string
  vendor: string
  amount: number
  date: string
  status: string
}

const invoiceTable = defineTable<Invoice>({
  rowKey: 'id',
  storageKey: 'invoices',
  columns: {
    vendor: { label: 'Vendor', type: 'text' },
    amount: { label: 'Amount', type: 'currency', currency: 'USD', sumInGroup: true },
    date:   { label: 'Date', type: 'date', datePeriods: ['month', 'quarter'] },
    status: { label: 'Status', type: 'text', groupable: true },
  },
  defaults: {
    sort: { field: 'date', direction: 'desc' },
  },
})

function InvoicesPage({ data }: { data: Invoice[] }) {
  return <DataTable {...invoiceTable} data={data} preset="full" />
}
```

### `defineColumns()` — typed array

For simpler cases where you want an array but still want type safety:

```tsx
import { defineColumns } from '@delta-and-beta/data-table'

const columns = defineColumns<Invoice>([
  { id: 'vendor', label: 'Vendor', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'currency', currency: 'USD' },
  { id: 'date', label: 'Date', type: 'date' },
])
```

### Column type reference

| Type | Sortable | Searchable | Groupable | Format |
|------|----------|------------|-----------|--------|
| `text` | yes | yes | yes | as-is |
| `number` | yes | no | yes | locale number |
| `currency` | yes | no | yes | Intl currency |
| `date` | yes | no | yes (with date periods) | Intl date |
| `custom` | no | no | no | via `render` |

All behavior flags (`sortable`, `searchable`, `groupable`, `visible`, `filterable`) can be overridden per column.

### Column options

```ts
interface ColumnDef<T> {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'currency' | 'custom'

  // Display
  render?: (value: unknown, row: T) => ReactNode
  headerRender?: () => ReactNode
  width?: string        // CSS width (e.g., '200px', '20%')
  align?: 'left' | 'center' | 'right'

  // Behavior
  sortable?: boolean
  groupable?: boolean
  searchable?: boolean
  visible?: boolean      // false to hide by default
  filterable?: boolean

  // Grouping
  datePeriods?: DatePeriod[]   // 'day' | 'week' | 'month' | 'quarter' | 'year'
  sumInGroup?: boolean         // aggregate in group headers

  // Formatting
  format?: (value: unknown) => string
  currency?: string            // ISO 4217 code (e.g., 'USD', 'EUR')
}
```

## Presets

### `preset="full"` — everything out of the box

Renders toolbar (search, filter, group-by, column toggle) + scrollable content + footer.

```tsx
<DataTable {...table} data={data} preset="full" />
```

### `preset="minimal"` — content only

Renders content + footer, no toolbar.

```tsx
<DataTable {...table} data={data} preset="minimal" />
```

### `preset="none"` — full control

Compose your own layout with sub-components:

```tsx
<DataTable {...table} data={data}>
  <DataTable.Toolbar>
    <DataTable.Search className="w-80" />
    <DataTable.ColumnToggle />
  </DataTable.Toolbar>
  <DataTable.Content stickyHeader onRowClick={handleClick} />
  <DataTable.Footer />
</DataTable>
```

## Features

### Search

Free-text search across all columns with `searchable: true` (default for `text` columns). Case-insensitive substring matching.

```tsx
// In preset="none" mode:
<DataTable.Search className="w-80" placeholder="Search..." />
```

### Sorting

Click column headers to sort. Supports ascending/descending toggle. Persisted to `localStorage` via `storageKey`.

```tsx
// Set default sort:
const table = defineTable<Row>({
  // ...
  defaults: { sort: { field: 'date', direction: 'desc' } },
})
```

### Group By

Multi-level grouping with drag-to-reorder. Date columns support period bucketing (day, week, month, quarter, year). Numeric/currency columns show sum aggregation in group headers.

```tsx
// In preset="none" mode:
<DataTable.GroupBy activeCount={2} isOpen={open} onClick={toggle} />
```

### Filtering

Condition-based filtering with nested groups and AND/OR conjunctions.

Supported operators by type:
- **Text**: is, is not, contains, does not contain, is empty, is not empty
- **Number/Currency**: =, !=, >, <, >=, <=, is empty, is not empty
- **Date**: is, is before, is after, is on or before, is on or after, is empty, is not empty

### Column Toggle

Show/hide columns via a dropdown. State persisted to `localStorage`.

### Attachments

Provide an `AttachmentAdapter` to enable file attachments per row:

```tsx
const adapter: AttachmentAdapter = {
  add: (rowId, file) => uploadFile(rowId, file),
  list: (rowId) => fetchAttachments(rowId),
  delete: (attachmentId) => deleteAttachment(attachmentId),
  getCounts: (rowIds) => fetchCounts(rowIds),
}

<DataTable {...table} data={data} attachmentAdapter={adapter} preset="full" />
```

## Theming

All colors are controlled via CSS custom properties. Override them to match your design system.

### Token reference

| Token | Default (dark) | Used for |
|-------|---------------|----------|
| `--dt-primary` | `#3b82f6` | Buttons, active states, links |
| `--dt-primary-hover` | `#2563eb` | Button hover states |
| `--dt-bg` | `#1a1a2e` | Table background |
| `--dt-bg-secondary` | `#16213e` | Alternating rows, panels |
| `--dt-border` | `#374151` | Table borders, dividers |
| `--dt-text` | `#f3f4f6` | Primary text |
| `--dt-muted` | `#9ca3af` | Secondary text, placeholders |
| `--dt-positive` | `#22c55e` | Positive values |
| `--dt-negative` | `#ef4444` | Negative values |

### Light theme

```css
:root {
  --dt-primary: #3b82f6;
  --dt-primary-hover: #2563eb;
  --dt-bg: #ffffff;
  --dt-bg-secondary: #f9fafb;
  --dt-border: #e5e7eb;
  --dt-text: #111827;
  --dt-muted: #6b7280;
  --dt-positive: #16a34a;
  --dt-negative: #dc2626;
}
```

Or import the preset: `import '@delta-and-beta/data-table/themes/light.css'`

### Scoped theming

Apply different themes to different tables by scoping variables:

```css
.invoices-table {
  --dt-primary: #8b5cf6;
  --dt-bg: #0f172a;
}

.orders-table {
  --dt-primary: #06b6d4;
  --dt-bg: #1e1b4b;
}
```

```tsx
<DataTable {...invoiceTable} data={invoices} preset="full" className="invoices-table" />
<DataTable {...orderTable} data={orders} preset="full" className="orders-table" />
```

## Custom Composition

### Sub-components

When using `preset="none"`, compose your layout with these sub-components:

| Component | Description |
|-----------|-------------|
| `DataTable.Toolbar` | Flex container for toolbar items |
| `DataTable.Search` | Search input |
| `DataTable.Filter` | Filter toolbar button |
| `DataTable.FilterPanel` | Filter configuration panel |
| `DataTable.GroupBy` | Group-by toolbar button |
| `DataTable.GroupByPanel` | Group-by configuration panel |
| `DataTable.ColumnToggle` | Column visibility toggle |
| `DataTable.DateFilter` | Date range filter |
| `DataTable.Content` | Table body (rows, groups, headers) |
| `DataTable.Footer` | Row count footer |
| `DataTable.GroupHeader` | Group header row |

### Standalone hooks

Each hook is independently importable for building fully custom UIs:

```tsx
import { useSearch, useSort, useGroupBy, useFilter, useColumns } from '@delta-and-beta/data-table'

function CustomTable({ data, columns }) {
  const filter = useFilter({ data, columns, storageKey: 'my-table' })
  const search = useSearch({ data: filter.filteredData, columns })
  const sort = useSort({ data: search.filteredData, storageKey: 'my-table' })
  const groupBy = useGroupBy({ data: sort.sortedData, columns, storageKey: 'my-table' })
  const columnState = useColumns({ columns, storageKey: 'my-table' })

  // Build your own UI with these values...
}
```

### Context

Access the full table state from any child component:

```tsx
import { useDataTable } from '@delta-and-beta/data-table'

function CustomFooter() {
  const { filteredData, groupBy } = useDataTable()
  return <div>{filteredData.length} records, {groupBy.levels.length} groups active</div>
}
```

## API Reference

### `DataTableProps<T>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Array of row objects |
| `columns` | `ColumnDef<T>[]` | required | Column definitions |
| `rowKey` | `keyof T & string` | required | Unique identifier field |
| `storageKey` | `string` | `'dt'` | localStorage key prefix |
| `preset` | `'full' \| 'minimal' \| 'none'` | `'none'` | Render mode |
| `attachmentAdapter` | `AttachmentAdapter` | — | File attachment backend |
| `defaultSort` | `{ field, direction }` | — | Initial sort state |
| `defaultGroupBy` | `GroupLevel[]` | — | Initial grouping |
| `onRowClick` | `(row: T) => void` | — | Row click handler |
| `onRowContextMenu` | `(row: T, event) => void` | — | Row right-click handler |
| `className` | `string` | — | Root element CSS class |
| `children` | `ReactNode` | — | Custom layout (preset="none") |

### `defineTable<T>(config)`

| Config field | Type | Description |
|-------------|------|-------------|
| `rowKey` | `keyof T & string` | Unique identifier field |
| `storageKey` | `string` | localStorage key prefix |
| `columns` | `{ [K in keyof T]?: ColumnConfig }` | Object-keyed column definitions |
| `defaults.sort` | `{ field, direction }` | Initial sort state |
| `defaults.groupBy` | `GroupLevel[]` | Initial grouping |

Returns `{ columns, rowKey, storageKey, defaultSort, defaultGroupBy }` — spread onto `<DataTable>`.

### Hook signatures

| Hook | Input | Key outputs |
|------|-------|-------------|
| `useSearch` | `{ data, columns }` | `filteredData`, `query`, `setQuery` |
| `useSort` | `{ data, defaultField?, defaultDirection?, storageKey? }` | `sortedData`, `sortField`, `sortDirection`, `setSort` |
| `useColumns` | `{ columns, storageKey? }` | `visibleColumns`, `isVisible`, `setColumnVisibility` |
| `useGroupBy` | `{ data, columns, sumFields?, storageKey? }` | `groupedData`, `levels`, `isGrouped`, `addGroup`, `removeGroup` |
| `useFilter` | `{ data, columns, storageKey? }` | `filteredData`, `root`, `enabled`, `activeCount`, `addCondition` |

## License

MIT
