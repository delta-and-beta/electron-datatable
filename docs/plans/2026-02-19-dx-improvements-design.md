# DX Improvements Design

**Date:** 2026-02-19
**Goal:** Reduce setup friction and improve discoverability for internal teams consuming `@delta-and-beta/data-table`. The table should inherit the parent app's design system by default, and provide a config-driven API for defining tables.

## Problem

Today, getting the data table running requires:

1. `npm install @delta-and-beta/data-table`
2. Import `dataTablePreset` into `tailwind.config.ts` and add to `presets`
3. Set CSS custom properties for theming (defaults are hardcoded dark theme)
4. Define a `ColumnDef[]` array with column IDs, types, and behavior flags
5. Wire up `<DataTable>` with multiple props spread across concerns

**Pain points:**
- Step 2 is boilerplate every consumer must do
- Step 3 fights the parent app's design system (dark-mode defaults override app tokens)
- Steps 4-5 require understanding multiple interfaces and where config lives
- No documentation -- teams read source code to understand features

## Solution

### 1. Generated CSS with base/theme split

Separate **structure** (utility classes the components need) from **theme** (color values). This lets the table inherit the parent app's design tokens by default.

**Three CSS outputs:**

| File | Contains | When to use |
|------|----------|-------------|
| `styles.css` | All `dt-*` utility classes (generated from component scan) | **Always** -- required base styles |
| `themes/dark.css` | `:root` block with dark theme variable values | Quick start without existing design system |
| `themes/light.css` | `:root` block with light theme variable values | Quick start without existing design system |

**New files:**

- `src/styles-input.css` -- Tailwind input with `@tailwind utilities` only (no variable defaults)
- `src/themes/dark.css` -- Dark theme CSS custom property values
- `src/themes/light.css` -- Light theme CSS custom property values
- `tailwind.build.config.ts` -- Build-only Tailwind config scanning `src/**/*.tsx`

**Input CSS (`src/styles-input.css`):**

```css
@tailwind utilities;
```

**Dark theme (`src/themes/dark.css`):**

```css
:root {
  --dt-primary: #3b82f6;
  --dt-primary-hover: #2563eb;
  --dt-bg: #1a1a2e;
  --dt-bg-secondary: #16213e;
  --dt-border: #374151;
  --dt-text: #f3f4f6;
  --dt-muted: #9ca3af;
  --dt-positive: #22c55e;
  --dt-negative: #ef4444;
}
```

**Light theme (`src/themes/light.css`):**

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

**Build config (`tailwind.build.config.ts`):**

```ts
import type { Config } from 'tailwindcss'
import { dataTablePreset } from './src/tailwind'

export default {
  content: ['./src/**/*.tsx'],
  presets: [dataTablePreset as Config],
} satisfies Config
```

**Build script (`package.json`):**

```json
"build": "tsup && tailwindcss -i src/styles-input.css -o dist/styles.css -c tailwind.build.config.ts --minify && cp src/themes dist/themes -r"
```

**Package exports:**

```json
"./styles.css": "./dist/styles.css",
"./themes/dark.css": "./dist/themes/dark.css",
"./themes/light.css": "./dist/themes/light.css"
```

**Consumer usage — team WITH existing design system (common case):**

```ts
import '@delta-and-beta/data-table/styles.css'
```

```css
/* Map existing app tokens to dt-* tokens */
:root {
  --dt-primary: var(--color-primary);
  --dt-bg: var(--color-bg);
  --dt-bg-secondary: var(--color-bg-secondary);
  --dt-border: var(--color-border);
  --dt-text: var(--color-text);
  --dt-muted: var(--color-text-muted);
  --dt-positive: var(--color-success);
  --dt-negative: var(--color-error);
}
```

**Consumer usage — team WITHOUT design system (quick start):**

```ts
import '@delta-and-beta/data-table/styles.css'
import '@delta-and-beta/data-table/themes/dark.css'
```

### 2. `defineTable` config API

A typed config builder that consolidates column definitions, feature defaults, and table settings into a single object. Produces props compatible with the existing `<DataTable>` component.

**New file: `src/defineTable.ts`**

```ts
import type { RowData, ColumnDef, GroupLevel, DataTableProps } from './types'

/** Column definition using object key as field ID */
type ColumnConfig<T extends RowData> = Omit<ColumnDef<T>, 'id'>

/** Table configuration object */
interface TableConfig<T extends RowData> {
  rowKey: keyof T & string
  storageKey?: string
  columns: { [K in keyof T]?: ColumnConfig<T> }
  defaults?: {
    sort?: { field: keyof T & string; direction: 'asc' | 'desc' }
    groupBy?: GroupLevel[]
  }
}

/** Return type — spread directly onto <DataTable> */
interface TableDefinition<T extends RowData> {
  columns: ColumnDef<T>[]
  rowKey: keyof T & string
  storageKey?: string
  defaultSort?: { field: string; direction: 'asc' | 'desc' }
  defaultGroupBy?: GroupLevel[]
}

export function defineTable<T extends RowData>(
  config: TableConfig<T>
): TableDefinition<T> {
  const columns: ColumnDef<T>[] = Object.entries(config.columns).map(
    ([id, col]) => ({ id, ...(col as ColumnConfig<T>) })
  )

  return {
    columns,
    rowKey: config.rowKey,
    storageKey: config.storageKey,
    defaultSort: config.defaults?.sort
      ? { field: config.defaults.sort.field, direction: config.defaults.sort.direction }
      : undefined,
    defaultGroupBy: config.defaults?.groupBy,
  }
}
```

**Consumer usage:**

```tsx
import { DataTable, defineTable } from '@delta-and-beta/data-table'

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

// Usage — spread the definition, add runtime props
function InvoicesPage({ data }: { data: Invoice[] }) {
  return (
    <DataTable {...invoiceTable} data={data} preset="full" onRowClick={handleClick} />
  )
}
```

**Key benefits:**

- Column IDs are `keyof Invoice` — typos caught at compile time
- Single object defines the entire table schema
- Output spreads directly onto `<DataTable>` — no new component API needed
- Backward compatible — `defineTable` is additive, existing array-based usage still works

**Also keep `defineColumns` for simpler cases:**

```ts
export function defineColumns<T extends RowData>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  return columns
}
```

### 3. Comprehensive README

Structure (progressive disclosure):

```
# @delta-and-beta/data-table

## Quick Start
  - npm install
  - import styles.css (+ optional theme import)
  - defineTable config
  - <DataTable> with preset="full" (5-line example)

## Installation
  - Package install
  - Style setup: base CSS + token mapping (with design system)
  - Style setup: base CSS + theme preset (without design system)
  - Alternative: Tailwind preset approach (for teams that prefer it)

## Defining Tables
  - defineTable() — config object approach (recommended)
  - defineColumns() — array approach with type safety
  - Raw ColumnDef[] — manual approach
  - Column type reference table (type → default behaviors)

## Presets
  - preset="full" — toolbar + content + footer
  - preset="minimal" — content + footer
  - preset="none" — full composition with children
  - Code example for each

## Features
  - Search
  - Sorting
  - Group By (multi-level, date periods, aggregation)
  - Filtering (condition-based, nested groups)
  - Column Toggle
  - Attachments

## Theming
  - Token reference table (--dt-* → what it affects)
  - Mapping from existing design system
  - Dark/light presets
  - Scoped theming (multiple tables with different themes)

## Custom Composition
  - Sub-components (DataTable.Toolbar, DataTable.Content, etc.)
  - Standalone hooks (useGroupBy, useSort, etc.)
  - Custom layout example

## API Reference
  - DataTableProps
  - ColumnDef<T>
  - defineTable() config shape
  - Hook return types
```

## Implementation order

1. Create `src/themes/dark.css` and `src/themes/light.css`
2. Create `src/styles-input.css` (utilities only, no theme)
3. Create `tailwind.build.config.ts`
4. Update `package.json`: build script, exports, copy themes
5. Create `src/defineTable.ts` with `defineTable` and `defineColumns`
6. Export both from `src/index.ts`
7. Write `README.md`
8. Verify build: `dist/styles.css`, `dist/themes/dark.css`, `dist/themes/light.css`
9. Test: consumer project with styles.css + token mapping (no Tailwind preset)

## What stays the same

- `dataTablePreset` export is **not removed** — backward compatible
- `<DataTable>` component API unchanged — `defineTable` output spreads onto existing props
- CSS custom property names unchanged
- All existing exports preserved
- Array-based `ColumnDef[]` still works

## Out of scope

- Storybook / demo app
- CLI init tool
- Tailwind v4-specific support
- Removing Tailwind as peer dependency
- Auto-inferring columns from data shape
