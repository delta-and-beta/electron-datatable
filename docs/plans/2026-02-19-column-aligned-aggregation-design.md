# Column-Aligned Aggregation in Group Headers

## Problem

When data is grouped, the aggregated sum displays as a single value floating to the far right of the group header row. This has three issues:

1. **Misaligned** — the sum is not positioned under the column it represents (e.g., "Amount" or "Amount (HKD)")
2. **No currency formatting** — the sum shows `+146,974.66` instead of using the column's own formatter (e.g., `HKD 146,974.66`)
3. **Single sum only** — only one `sumField` can be passed to `<Content>`, so tables with multiple numeric columns can only aggregate one

## Design

### Layout: Per-Column Cells

Replace the current `<td colSpan={N}>` approach with one `<td>` per visible column:

- **First cell:** Chevron + field badge + group key + count badge (same group label as today)
- **Aggregatable cells** (`type === 'currency' || type === 'number'` with `sumInGroup !== false`): Formatted sum value using the column's own formatter
- **Non-aggregatable cells:** Empty

The invisible sentinel row for sticky detection keeps its `colSpan` — only the visible header row changes.

### Formatting Pipeline

Aggregatable cells follow this render priority (same as data cells):

1. `renderCell(column, sumValue)` — if passed as prop to GroupHeader
2. `column.render(sumValue, {})` — column-level custom renderer
3. `column.format(sumValue)` — column-level format function
4. `formatCurrency(sumValue, column.currency)` — for `type: 'currency'`
5. `formatNumber(sumValue)` — for `type: 'number'`

When using `<Content>`, step 1 is wired automatically. When using `<GroupHeader>` directly, consumers must pass `renderCell` themselves (see Migration below).

### Aggregation Functions

Type-aware defaults only, no user-selectable functions:

- `currency` / `number` columns → **sum** (controlled by `sumInGroup` flag)
- `text` / `date` / `custom` columns → **none**

### Color Coding

Aggregated values use positive/negative color coding:

- `sumValue < 0` → `text-dt-negative`
- `sumValue >= 0` → `text-dt-positive`

## API Changes

### GroupHeaderProps (breaking)

```diff
 export interface GroupHeaderProps {
   groupKey: string
   fieldLabel: string
   level: number
   count: number
-  sumAmount?: number
-  sumLabel?: string
   isCollapsed: boolean
   onToggle: () => void
-  colSpan: number
   stickyOffset?: number
-  formatSum?: (amount: number) => string
+  columns: ColumnDef[]
+  sums: Record<string, number>
+  renderCell?: (column: ColumnDef, value: unknown) => React.ReactNode
 }
```

### ContentProps (breaking)

```diff
 interface ContentProps {
   emptyMessage?: string
   stickyHeader?: boolean
   rowClassName?: (row: RowData) => string | undefined
   className?: string
   renderCell?: (column: ColumnDef, value: unknown, row: RowData) => React.ReactNode
   onRowClick?: (row: RowData) => void
-  sumField?: string
-  sumLabel?: string
 }
```

## Migration

### If you use `<Content>` (or `preset="full"`)

No code changes needed beyond removing the old props:

```diff
-<Content sumField="amount" sumLabel="HKD" />
+<Content />
```

Aggregation is automatic. If you pass a `renderCell` prop to `<Content>`, it is forwarded to `GroupHeader` automatically.

### If you use `<GroupHeader>` directly

You must update the props **and** pass `renderCell` if you have custom cell formatting:

```diff
 <GroupHeader
   groupKey={section.key}
   fieldLabel={section.fieldLabel}
   level={section.level}
   count={section.count}
-  sumAmount={section.sums.amount}
-  sumLabel="HKD"
-  colSpan={colSpan}
+  columns={visibleColumns}
+  sums={section.sums}
+  renderCell={renderAggregateCell}  // Required if you format cells yourself
   isCollapsed={collapsed}
   onToggle={() => groupBy.toggleCollapse(path)}
 />
```

The `renderCell` callback tells GroupHeader how to format each aggregate value. Without it, GroupHeader falls back to the column's `render`/`format` function, then to type-based defaults (`formatCurrency`/`formatNumber`).

**Example:** If your data cells use custom formatting functions:

```tsx
// Define once, reuse for all <GroupHeader> calls
const renderAggregateCell = useCallback((col: ColumnDef, value: unknown) => {
  switch (col.id) {
    case 'amount':
      return formatAmount(value as number | null, 'HKD')
    case 'amount_hkd':
      return formatAmountHkd(value as number | null)
    default:
      return null  // non-aggregatable columns return null
  }
}, [])
```

**Alternative (DRY):** Put formatting on the column definition itself via `render`, then you don't need `renderCell` at all:

```tsx
const columns: ColumnDef[] = [
  {
    id: 'amount_hkd',
    label: 'Amount (HKD)',
    type: 'number',
    align: 'right',
    render: (value) => formatAmountHkd(value as number | null),
  },
]
```

This way both data cells and aggregate cells use the same `render` function automatically.

## Files Changed

| File | Change |
|------|--------|
| `src/components/headers/GroupHeader.tsx` | Per-column cells, new props, renderCell support |
| `src/components/Content.tsx` | Remove `sumField`/`sumLabel`, wire renderCell to GroupHeader |
| `src/lib/format-aggregate.ts` | New helper for type-based aggregate formatting |
| `src/lib/format-aggregate.test.ts` | Unit tests for formatAggregateValue |
| `src/components/headers/GroupHeader.test.tsx` | Component tests for per-column rendering |
| `src/index.ts` | Export formatAggregateValue |

No changes to: `types.ts`, `group-by.ts`, `format.ts`, `DataTable.tsx`, localStorage format.
