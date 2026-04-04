# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@delta-and-beta/data-table` production-ready across robustness, accessibility, testing, and tooling.

**Architecture:** Bug fixes and edge case guards come first to establish correct behavior. Error boundary and dev warnings add safety nets. Accessibility changes modify component APIs that tests will assert against. Tests are written after the final component behavior is locked in. Tooling (ESLint, debounce, changelog) is independent and comes last.

**Tech Stack:** React 18, TypeScript, vitest, @testing-library/react, jsdom, ESLint with typescript-eslint + react-hooks plugin

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/dev-warn.ts` | `devWarn()` utility — console.warn only in dev mode |
| `src/components/ErrorBoundary.tsx` | Internal error boundary for DataTable subtree |
| `src/hooks/useDebounce.ts` | Generic debounce hook for search |
| `src/lib/sort.test.ts` | Sort logic unit tests |
| `src/lib/search.test.ts` | Search logic unit tests |
| `src/hooks/useSort.test.tsx` | Sort hook tests |
| `src/hooks/useColumns.test.tsx` | Columns hook tests |
| `src/hooks/useFilter.test.tsx` | Filter hook tests |
| `src/hooks/useSearch.test.tsx` | Search hook tests |
| `src/components/DataTable.test.tsx` | Integration tests |
| `src/components/Content.test.tsx` | Content component tests |
| `src/components/toolbar/toolbar.test.tsx` | Toolbar component tests |
| `eslint.config.js` | ESLint flat config |
| `CHANGELOG.md` | Keep a Changelog format |

### Modified files

| File | Changes |
|------|---------|
| `src/lib/search.ts` | Fix searchable fallback bug |
| `src/hooks/useSort.ts` | localStorage shape validation |
| `src/hooks/useColumns.ts` | localStorage shape validation |
| `src/hooks/useGroupBy.ts` | localStorage shape validation |
| `src/hooks/useFilter.ts` | localStorage shape validation |
| `src/hooks/useSearch.ts` | Integrate debounced search |
| `src/components/Content.tsx` | colSpan fix, ARIA, keyboard nav, row key fix |
| `src/components/DataTable.tsx` | ErrorBoundary wrapper, dev warnings |
| `src/components/headers/GroupHeader.tsx` | ARIA expanded, keyboard nav |
| `src/components/toolbar/Search.tsx` | aria-label on clear button |
| `src/components/toolbar/ColumnToggle.tsx` | ARIA, Escape, focus, move up/down buttons |
| `src/components/toolbar/GroupByConfigPanel.tsx` | ARIA, Escape, focus, move up/down buttons |
| `src/components/toolbar/FilterConfigPanel.tsx` | ARIA, Escape, focus management |
| `src/components/toolbar/FilterToolbarButton.tsx` | aria-haspopup, aria-expanded |
| `src/components/toolbar/GroupByToolbarButton.tsx` | aria-haspopup, aria-expanded |
| `package.json` | Add ESLint dev dependencies |

---

## Task 1: Fix search.ts logic bug

**Files:**
- Modify: `src/lib/search.ts:12-21`

When all columns have `searchable: false`, the current code falls back to searching ALL columns. Fix: when no columns are searchable, return all records (search is disabled).

- [ ] **Step 1: Fix the searchable column logic**

Replace the current field resolution logic in `src/lib/search.ts`:

```ts
import type { RowData, ColumnDef } from '../types'

/** Filter records by a search query across searchable columns */
export function searchRecords<T extends RowData>(
  records: T[],
  query: string,
  columns: ColumnDef<T>[],
): T[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return records

  // Columns that explicitly opt in, OR are text/custom and don't opt out
  const fields = columns
    .filter((col) => {
      if (col.searchable === true) return true
      if (col.searchable === false) return false
      return col.type === 'text' || col.type === 'custom'
    })
    .map((col) => col.id)

  // No searchable columns → search is disabled, return all records
  if (fields.length === 0) return records

  return records.filter((record) =>
    fields.some((field) => {
      const value = record[field]
      if (value == null) return false
      return String(value).toLowerCase().includes(trimmed)
    }),
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All 66 tests pass (search.ts had no tests, so nothing breaks)

- [ ] **Step 4: Commit**

```bash
git add src/lib/search.ts
git commit -m "fix(search): don't search all columns when all are marked non-searchable"
```

---

## Task 2: Fix Content.tsx colSpan and row key

**Files:**
- Modify: `src/components/Content.tsx:75,89`

- [ ] **Step 1: Fix colSpan to never be 0**

In `src/components/Content.tsx`, change line 75 from:

```ts
  const colSpan = visibleColumns.length
```

to:

```ts
  const colSpan = Math.max(visibleColumns.length, 1)
```

- [ ] **Step 2: Fix row key fallback to avoid collisions**

In `src/components/Content.tsx`, change line 89 from:

```ts
    const key = row[rowKey] != null ? String(row[rowKey]) : index
```

to:

```ts
    const key = row[rowKey] != null ? String(row[rowKey]) : `row-${index}`
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Content.tsx
git commit -m "fix(Content): prevent colSpan=0 and row key collisions"
```

---

## Task 3: Harden localStorage recovery in all hooks

**Files:**
- Modify: `src/hooks/useSort.ts:25-35`
- Modify: `src/hooks/useColumns.ts:17-41`
- Modify: `src/hooks/useGroupBy.ts:22-65`
- Modify: `src/hooks/useFilter.ts:54-81`

Each hook parses localStorage but doesn't validate the shape. If the parsed JSON has wrong types (e.g. `visible` is a number instead of array), the code crashes outside the try/catch.

- [ ] **Step 1: Harden useSort localStorage recovery**

In `src/hooks/useSort.ts`, replace the useState initializer (lines 25-35):

```ts
  const [state, setState] = useState<SortState>(() => {
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (
            parsed &&
            typeof parsed.field === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            return parsed as SortState
          }
        }
      } catch {
        // ignore
      }
    }
    return { field: defaultField ?? null, direction: defaultDirection }
  })
```

- [ ] **Step 2: Harden useColumns localStorage recovery**

In `src/hooks/useColumns.ts`, replace the useState initializer (lines 17-41):

```ts
  const [state, setState] = useState<ColumnState>(() => {
    if (fullKey) {
      try {
        const saved = localStorage.getItem(fullKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (
            parsed &&
            Array.isArray(parsed.visible) &&
            Array.isArray(parsed.order)
          ) {
            const validIds = new Set(columns.map((c) => c.id))
            return {
              visible: parsed.visible.filter((id: unknown) => typeof id === 'string' && validIds.has(id)),
              order: parsed.order.filter((id: unknown) => typeof id === 'string' && validIds.has(id)),
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      visible: columns.filter((c) => c.visible !== false).map((c) => c.id),
      order: columns.map((c) => c.id),
    }
  })
```

- [ ] **Step 3: Harden useGroupBy localStorage recovery**

In `src/hooks/useGroupBy.ts`, replace the three useState initializers (lines 22-65):

```ts
  const [levels, setLevels] = useState<GroupLevel[]>(() => {
    if (!fullKey) return []
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && Array.isArray(config.groups)) {
          const validFields = new Set(columns.filter((c) => c.groupable !== false).map((c) => c.id))
          return config.groups.filter(
            (g: unknown) => g && typeof g === 'object' && 'field' in g && typeof (g as GroupLevel).field === 'string' && validFields.has((g as GroupLevel).field)
          )
        }
      }
    } catch {
      // ignore
    }
    return []
  })

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!fullKey) return new Set()
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && Array.isArray(config.collapsed)) {
          return new Set(config.collapsed.filter((v: unknown) => typeof v === 'string'))
        }
      }
    } catch {
      // ignore
    }
    return new Set()
  })

  const [showEmpty, setShowEmpty] = useState<boolean>(() => {
    if (!fullKey) return false
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && typeof config.showEmpty === 'boolean') {
          return config.showEmpty
        }
      }
    } catch {
      // ignore
    }
    return false
  })
```

- [ ] **Step 4: Harden useFilter localStorage recovery**

In `src/hooks/useFilter.ts`, replace the two useState initializers (lines 54-81):

```ts
  const [root, setRoot] = useState<FilterGroup>(() => {
    if (!fullKey) return createEmptyGroup()
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (
          config &&
          config.root &&
          typeof config.root.id === 'string' &&
          Array.isArray(config.root.conditions) &&
          Array.isArray(config.root.groups)
        ) {
          const validFields = new Set(columns.filter((c) => c.filterable !== false).map((c) => c.id))
          return validateFilterGroup(config.root, validFields)
        }
      }
    } catch {
      // ignore
    }
    return createEmptyGroup()
  })

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!fullKey) return true
    try {
      const saved = localStorage.getItem(fullKey)
      if (saved) {
        const config = JSON.parse(saved)
        if (config && typeof config.enabled === 'boolean') {
          return config.enabled
        }
      }
    } catch {
      // ignore
    }
    return true
  })
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run`
Expected: All 66 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSort.ts src/hooks/useColumns.ts src/hooks/useGroupBy.ts src/hooks/useFilter.ts
git commit -m "fix(hooks): validate localStorage shape before using parsed state"
```

---

## Task 4: Add ErrorBoundary and dev warnings

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/lib/dev-warn.ts`
- Modify: `src/components/DataTable.tsx`

- [ ] **Step 1: Create dev-warn utility**

Create `src/lib/dev-warn.ts`:

```ts
/** Log a warning in development. Tree-shaken out of production builds. */
export function devWarn(condition: boolean, message: string): void {
  if (condition && process.env.NODE_ENV !== 'production') {
    console.warn(`[DataTable] ${message}`)
  }
}
```

- [ ] **Step 2: Create ErrorBoundary component**

Create `src/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class DataTableErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DataTable] Render error:', error, info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--dt-muted, #9ca3af)',
            fontSize: '14px',
          }}
        >
          <p>Table failed to render.</p>
          {process.env.NODE_ENV !== 'production' && (
            <pre style={{ marginTop: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: Wire ErrorBoundary and dev warnings into DataTable**

In `src/components/DataTable.tsx`, add imports at the top after existing imports:

```ts
import { DataTableErrorBoundary } from './ErrorBoundary'
import { devWarn } from '../lib/dev-warn'
```

Add a `useEffect` for dev warnings inside `DataTableRoot`, after the `contextValue` memo and before the preset conditionals:

```ts
  // Dev-mode config validation
  useEffect(() => {
    devWarn(columns.length === 0, 'columns array is empty')
    devWarn(
      data.length > 0 && !(rowKey in data[0]),
      `rowKey "${rowKey}" not found on data items`,
    )
    devWarn(storageKey === '', 'storageKey is empty string, localStorage persistence disabled')
    devWarn(
      !!defaultSort?.field && !columns.some((c) => c.id === defaultSort.field),
      `defaultSort field "${defaultSort?.field}" not found in columns`,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

Wrap each of the three return statements in `DataTableRoot` with the error boundary. Replace all three return blocks.

For `preset === 'full'` (around lines 118-126):

```tsx
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue as DataTableContextValue}>
          <div className={className}>
            <FullPreset onRowClick={onRowClick as ((row: RowData) => void) | undefined} />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
```

For `preset === 'minimal'` (around lines 130-138):

```tsx
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue as DataTableContextValue}>
          <div className={className}>
            <Content onRowClick={onRowClick as ((row: RowData) => void) | undefined} />
            <Footer />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
```

For the default return (around lines 140-144):

```tsx
  return (
    <DataTableErrorBoundary>
      <DataTableProvider value={contextValue as DataTableContextValue}>
        <div className={className}>{children}</div>
      </DataTableProvider>
    </DataTableErrorBoundary>
  )
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run`
Expected: All 66 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev-warn.ts src/components/ErrorBoundary.tsx src/components/DataTable.tsx
git commit -m "feat: add error boundary and dev-mode config warnings"
```

---

## Task 5: Accessibility — Table semantics and sort headers

**Files:**
- Modify: `src/components/Content.tsx:182-206`

- [ ] **Step 1: Add ARIA to table headers and make sort buttons accessible**

In `src/components/Content.tsx`, replace the `<TableHeader>` block (lines 182-206) with:

```tsx
      <TableHeader className={cn(stickyHeader && 'sticky top-0 z-20 bg-dt-bg')}>
        <TableRow>
          {visibleColumns.map((col) => {
            const align = getAlign(col)
            const isSortable = col.sortable !== false

            const ariaSortValue = !isSortable
              ? undefined
              : sort.sortField !== col.id
                ? 'none' as const
                : sort.sortDirection === 'asc'
                  ? 'ascending' as const
                  : 'descending' as const

            return (
              <TableHead
                key={col.id}
                scope="col"
                aria-sort={ariaSortValue}
                className={cn(
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => sort.setSort(col.id)}
                    className="inline-flex items-center gap-0.5 cursor-pointer select-none bg-transparent border-none p-0 font-medium text-dt-muted hover:text-dt-text"
                  >
                    {col.headerRender ? col.headerRender() : col.label}
                    {renderSortIcon(col.id)}
                  </button>
                ) : (
                  col.headerRender ? col.headerRender() : col.label
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/Content.tsx
git commit -m "a11y(Content): add scope, aria-sort, and button elements to sort headers"
```

---

## Task 6: Accessibility — Clickable rows and group headers

**Files:**
- Modify: `src/components/Content.tsx:88-123` (rows)
- Modify: `src/components/headers/GroupHeader.tsx:187-193` (group header)

- [ ] **Step 1: Make clickable rows keyboard-accessible**

In `src/components/Content.tsx`, replace the `renderRow` function (lines 88-123):

```tsx
  function renderRow(row: RowData, index: number) {
    const key = row[rowKey] != null ? String(row[rowKey]) : `row-${index}`
    const isClickable = !!onRowClick

    return (
      <TableRow
        key={key}
        data-row-id={row[rowKey] != null ? String(row[rowKey]) : undefined}
        className={cn(
          isClickable && 'cursor-pointer',
          rowClassName?.(row),
        )}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => onRowClick(row) : undefined}
        onKeyDown={
          isClickable
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRowClick(row)
                }
              }
            : undefined
        }
      >
        {visibleColumns.map((col) => {
          const value = row[col.id]
          const align = getAlign(col)
          return (
            <TableCell
              key={col.id}
              className={cn(
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
              )}
              style={col.width ? { width: col.width } : undefined}
            >
              {renderCell
                ? renderCell(col, value, row)
                : col.render
                  ? col.render(value, row)
                  : defaultRenderCell(col, value)}
            </TableCell>
          )
        })}
      </TableRow>
    )
  }
```

- [ ] **Step 2: Make group header keyboard-accessible**

In `src/components/headers/GroupHeader.tsx`, modify the visible sticky header `<tr>` (around line 187-194). Change:

```tsx
      <tr
        ref={cellRef}
        className={cn(
          'group/header sticky z-10 cursor-pointer',
        )}
        style={{ top: stickyOffset }}
        onClick={onToggle}
      >
```

to:

```tsx
      <tr
        ref={cellRef}
        className={cn(
          'group/header sticky z-10 cursor-pointer',
        )}
        style={{ top: stickyOffset }}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-label={`${fieldLabel}: ${groupKey}, ${count} records, ${isCollapsed ? 'collapsed' : 'expanded'}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Content.tsx src/components/headers/GroupHeader.tsx
git commit -m "a11y: keyboard navigation for clickable rows and group headers"
```

---

## Task 7: Accessibility — Toolbar buttons (ARIA attributes)

**Files:**
- Modify: `src/components/toolbar/FilterToolbarButton.tsx:25-39`
- Modify: `src/components/toolbar/GroupByToolbarButton.tsx:15-28`
- Modify: `src/components/toolbar/Search.tsx:24-29`

- [ ] **Step 1: Add aria-haspopup and aria-expanded to FilterToolbarButton**

In `src/components/toolbar/FilterToolbarButton.tsx`, add ARIA attributes to the main button (line 25-39). Change:

```tsx
      <button
        onClick={onClick}
        className={cn(
```

to:

```tsx
      <button
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
```

- [ ] **Step 2: Add aria-haspopup and aria-expanded to GroupByToolbarButton**

In `src/components/toolbar/GroupByToolbarButton.tsx`, add ARIA attributes to the button (line 15). Change:

```tsx
    <button
      onClick={onClick}
      className={cn(
```

to:

```tsx
    <button
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className={cn(
```

- [ ] **Step 3: Add aria-label to Search clear button**

In `src/components/toolbar/Search.tsx`, add `aria-label` to the clear button (line 24-29). Change:

```tsx
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
```

to:

```tsx
        <button
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/toolbar/FilterToolbarButton.tsx src/components/toolbar/GroupByToolbarButton.tsx src/components/toolbar/Search.tsx
git commit -m "a11y: add aria-haspopup, aria-expanded, and aria-label to toolbar buttons"
```

---

## Task 8: Accessibility — Dropdown panels (Escape, focus, dialog role)

**Files:**
- Modify: `src/components/toolbar/ColumnToggle.tsx`
- Modify: `src/components/toolbar/GroupByConfigPanel.tsx`
- Modify: `src/components/toolbar/FilterConfigPanel.tsx`

All three panels need: `role="dialog"`, `aria-label`, Escape key closes, focus first element on open, return focus to trigger on close.

- [ ] **Step 1: Update ColumnToggle**

In `src/components/toolbar/ColumnToggle.tsx`, add imports at the top:

```ts
import { useState, useRef, useEffect } from 'react'
```

Add a ref for the trigger button and a panel ref. Replace the component body to add ARIA and keyboard handling:

```tsx
export function ColumnToggle({ className }: ColumnToggleProps) {
  const { columns, columnState } = useDataTable()
  const [open, setOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus first interactive element when panel opens; return focus on close
  useEffect(() => {
    if (open) {
      // Small delay to allow panel to render
      requestAnimationFrame(() => {
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      })
    }
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
  }

  function handleMoveUp(id: string) {
    const index = columnState.allColumns.indexOf(id)
    if (index > 0) columnState.reorderColumns(index, index - 1)
  }

  function handleMoveDown(id: string) {
    const index = columnState.allColumns.indexOf(id)
    if (index < columnState.allColumns.length - 1) columnState.reorderColumns(index, index + 1)
  }
```

Update the button to use the ref and ARIA:

```tsx
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
          'border-gray-600 text-gray-300 hover:bg-gray-700',
          open && 'bg-gray-700',
        )}
      >
```

Update the dropdown panel to use dialog role, keydown handler, and move buttons:

```tsx
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Toggle column visibility"
            onKeyDown={handlePanelKeyDown}
            className="absolute top-full left-0 z-50 mt-1 w-[240px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
          >
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs text-gray-400">Toggle and reorder columns</span>
            </div>

            <div className="py-1 max-h-[300px] overflow-y-auto">
              {columnState.allColumns.map((id, idx) => {
                const visible = columnState.isVisible(id)
                const isFirst = idx === 0
                const isLast = idx === columnState.allColumns.length - 1

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, id)}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700/50 transition-colors',
                      draggedId === id && 'opacity-50',
                      dropTargetId === id && draggedId !== null && draggedId !== id && 'border-t border-blue-500/50',
                    )}
                  >
                    <span
                      className="cursor-grab text-gray-500 hover:text-gray-300 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>

                    <button
                      type="button"
                      onClick={() => columnState.setColumnVisibility(id, !visible)}
                      className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          visible ? 'bg-blue-500 border-blue-500' : 'border-gray-600 bg-gray-700',
                        )}
                      >
                        {visible && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs text-gray-200 truncate">{getColumnLabel(id)}</span>
                    </button>

                    <div className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(id)}
                        disabled={isFirst}
                        aria-label={`Move ${getColumnLabel(id)} up`}
                        className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M3 5l3-3 3 3"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(id)}
                        disabled={isLast}
                        aria-label={`Move ${getColumnLabel(id)} down`}
                        className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 10V2M3 7l3 3 3-3"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
```

- [ ] **Step 2: Update GroupByConfigPanel**

In `src/components/toolbar/GroupByConfigPanel.tsx`, add `useRef` and `useEffect` imports. Add refs and focus/escape handling. The changes are:

Add at the top of the component function, after `useDropdownAlign`:

```ts
  const triggerRefProp = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [])
```

Replace the backdrop and panel opening with Escape handling. Change the backdrop's `onClick` to use `onClose`, and add to the panel div:

```tsx
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Group by configuration"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        className={cn("absolute top-full z-50 mt-1 w-[520px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl", alignRight ? 'right-0' : 'left-0')}
      >
```

Add move up/down buttons next to each group level's delete button. Inside the level map, after the delete button:

```tsx
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => { if (index > 0) onReorderGroups(index, index - 1) }}
                      disabled={index === 0}
                      aria-label={`Move ${getColumnLabel(level.field)} up`}
                      className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M3 5l3-3 3 3"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (index < levels.length - 1) onReorderGroups(index, index + 1) }}
                      disabled={index === levels.length - 1}
                      aria-label={`Move ${getColumnLabel(level.field)} down`}
                      className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-25 disabled:cursor-default"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 10V2M3 7l3 3 3-3"/></svg>
                    </button>
                  </div>
```

- [ ] **Step 3: Update FilterConfigPanel**

In `src/components/toolbar/FilterConfigPanel.tsx`, add `useRef` and `useEffect` imports. Add focus/escape handling to the `FilterConfigPanel` component:

```ts
  const triggerRefProp = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [])
```

Add to the panel div:

```tsx
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Filter configuration"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        className={cn("absolute top-full z-50 mt-1 w-[520px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl", alignRight ? 'right-0' : 'left-0')}
      >
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/toolbar/ColumnToggle.tsx src/components/toolbar/GroupByConfigPanel.tsx src/components/toolbar/FilterConfigPanel.tsx
git commit -m "a11y: Escape key, focus management, dialog role, and move up/down buttons in panels"
```

---

## Task 9: Tests — sort.ts and search.ts

**Files:**
- Create: `src/lib/sort.test.ts`
- Create: `src/lib/search.test.ts`

- [ ] **Step 1: Write sort.test.ts**

Create `src/lib/sort.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compareValues, sortRecords } from './sort'

describe('compareValues', () => {
  it('sorts numbers numerically', () => {
    expect(compareValues(2, 10, 'asc')).toBeLessThan(0)
    expect(compareValues(10, 2, 'asc')).toBeGreaterThan(0)
    expect(compareValues(5, 5, 'asc')).toBe(0)
  })

  it('reverses order for desc', () => {
    expect(compareValues(2, 10, 'desc')).toBeGreaterThan(0)
    expect(compareValues(10, 2, 'desc')).toBeLessThan(0)
  })

  it('sorts strings with locale-aware numeric ordering', () => {
    expect(compareValues('banana', 'apple', 'asc')).toBeGreaterThan(0)
    expect(compareValues('10', '2', 'asc')).toBeGreaterThan(0) // numeric: true
  })

  it('sorts null/undefined last regardless of direction', () => {
    expect(compareValues(null, 'a', 'asc')).toBe(1)
    expect(compareValues(null, 'a', 'desc')).toBe(1)
    expect(compareValues('a', null, 'asc')).toBe(-1)
    expect(compareValues(undefined, 'a', 'asc')).toBe(1)
    expect(compareValues(null, null, 'asc')).toBe(0)
  })

  it('falls back to string comparison for mixed types', () => {
    const result = compareValues(100, 'abc', 'asc')
    expect(typeof result).toBe('number')
  })

  it('handles empty string vs null', () => {
    // Empty string is non-null, so it sorts before null
    expect(compareValues('', null, 'asc')).toBe(-1)
  })
})

describe('sortRecords', () => {
  const data = [
    { name: 'Charlie', age: 30 },
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 35 },
  ]

  it('sorts by string field ascending', () => {
    const result = sortRecords(data, 'name', 'asc')
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts by string field descending', () => {
    const result = sortRecords(data, 'name', 'desc')
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts by number field', () => {
    const result = sortRecords(data, 'age', 'asc')
    expect(result.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('does not mutate the original array', () => {
    const original = [...data]
    sortRecords(data, 'name', 'asc')
    expect(data).toEqual(original)
  })

  it('handles records with null values', () => {
    const withNulls = [
      { name: 'Bob', age: 30 },
      { name: null, age: null },
      { name: 'Alice', age: 25 },
    ]
    const result = sortRecords(withNulls, 'name', 'asc')
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', null])
  })
})
```

- [ ] **Step 2: Write search.test.ts**

Create `src/lib/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { searchRecords } from './search'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'date', label: 'Date', type: 'date' },
]

const data = [
  { name: 'Alice', email: 'alice@example.com', amount: 100, date: '2024-01-01' },
  { name: 'Bob', email: 'bob@test.com', amount: 200, date: '2024-06-01' },
  { name: 'Charlie', email: 'charlie@example.com', amount: 50, date: '2024-03-01' },
]

describe('searchRecords', () => {
  it('returns all records for empty query', () => {
    expect(searchRecords(data, '', columns)).toEqual(data)
    expect(searchRecords(data, '   ', columns)).toEqual(data)
  })

  it('searches text columns by default', () => {
    const result = searchRecords(data, 'alice', columns)
    expect(result).toHaveLength(2) // name='Alice' and email='alice@example.com'
    expect(result.every((r) => String(r.name).toLowerCase().includes('alice') || String(r.email).toLowerCase().includes('alice'))).toBe(true)
  })

  it('is case insensitive', () => {
    const result = searchRecords(data, 'ALICE', columns)
    expect(result).toHaveLength(2)
  })

  it('does not search non-text columns by default', () => {
    // "100" is in amount (number) and should NOT match by default
    const result = searchRecords(data, '100', columns)
    expect(result).toHaveLength(0)
  })

  it('respects searchable: true on non-text columns', () => {
    const searchableAmount: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'amount', label: 'Amount', type: 'number', searchable: true },
    ]
    const result = searchRecords(data, '100', searchableAmount)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('respects searchable: false on text columns', () => {
    const noSearchName: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', searchable: false },
      { id: 'email', label: 'Email', type: 'text' },
    ]
    const result = searchRecords(data, 'Alice', noSearchName)
    // Should NOT find 'Alice' since name is not searchable; email doesn't contain 'alice' directly
    // Actually alice@example.com contains 'alice'
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('alice@example.com')
  })

  it('returns all records when all columns are non-searchable', () => {
    const allNonSearchable: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text', searchable: false },
      { id: 'amount', label: 'Amount', type: 'number', searchable: false },
    ]
    // Bug fix: should return all records, not search everything
    const result = searchRecords(data, 'Alice', allNonSearchable)
    expect(result).toHaveLength(3) // all records returned, search disabled
  })

  it('handles null/undefined values in records', () => {
    const withNulls = [
      { name: null, email: 'test@test.com', amount: 0, date: '' },
      { name: 'Alice', email: null, amount: 100, date: '2024-01-01' },
    ]
    const result = searchRecords(withNulls, 'test', columns)
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('test@test.com')
  })
})
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/lib/sort.test.ts src/lib/search.test.ts`
Expected: All tests pass

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (old + new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sort.test.ts src/lib/search.test.ts
git commit -m "test: add sort and search pure logic tests"
```

---

## Task 10: Tests — Hook tests

**Files:**
- Create: `src/hooks/useSort.test.tsx`
- Create: `src/hooks/useColumns.test.tsx`
- Create: `src/hooks/useFilter.test.tsx`
- Create: `src/hooks/useSearch.test.tsx`

- [ ] **Step 1: Write useSort.test.tsx**

Create `src/hooks/useSort.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from './useSort'

const data = [
  { name: 'Charlie', age: 30 },
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 35 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useSort', () => {
  it('returns unsorted data when no field is set', () => {
    const { result } = renderHook(() => useSort({ data }))
    expect(result.current.sortedData).toEqual(data)
    expect(result.current.sortField).toBeNull()
  })

  it('sorts by default field on mount', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'asc' }),
    )
    expect(result.current.sortedData.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('toggles direction when clicking same field', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'asc' }),
    )
    act(() => result.current.setSort('name'))
    expect(result.current.sortDirection).toBe('desc')
    act(() => result.current.setSort('name'))
    expect(result.current.sortDirection).toBe('asc')
  })

  it('resets to asc when clicking a new field', () => {
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', defaultDirection: 'desc' }),
    )
    act(() => result.current.setSort('age'))
    expect(result.current.sortField).toBe('age')
    expect(result.current.sortDirection).toBe('asc')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() =>
      useSort({ data, storageKey: 'test' }),
    )
    act(() => result.current.setSort('name'))
    const saved = JSON.parse(localStorage.getItem('test-sort')!)
    expect(saved).toEqual({ field: 'name', direction: 'asc' })
  })

  it('restores from localStorage', () => {
    localStorage.setItem('test-sort', JSON.stringify({ field: 'age', direction: 'desc' }))
    const { result } = renderHook(() =>
      useSort({ data, storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('age')
    expect(result.current.sortDirection).toBe('desc')
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-sort', 'not valid json')
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('name')
  })

  it('falls back to defaults when localStorage has wrong shape', () => {
    localStorage.setItem('test-sort', JSON.stringify({ field: 123, direction: 'invalid' }))
    const { result } = renderHook(() =>
      useSort({ data, defaultField: 'name', storageKey: 'test' }),
    )
    expect(result.current.sortField).toBe('name')
  })
})
```

- [ ] **Step 2: Write useColumns.test.tsx**

Create `src/hooks/useColumns.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useColumns } from './useColumns'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'age', label: 'Age', type: 'number' },
  { id: 'hidden', label: 'Hidden', type: 'text', visible: false },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useColumns', () => {
  it('defaults all columns to visible except visible: false', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    expect(result.current.visibleColumns).toEqual(['name', 'email', 'age'])
    expect(result.current.isVisible('hidden')).toBe(false)
  })

  it('toggles column visibility', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    act(() => result.current.setColumnVisibility('email', false))
    expect(result.current.visibleColumns).toEqual(['name', 'age'])
    act(() => result.current.setColumnVisibility('email', true))
    expect(result.current.visibleColumns).toContain('email')
  })

  it('reorders columns', () => {
    const { result } = renderHook(() => useColumns({ columns }))
    act(() => result.current.reorderColumns(0, 2))
    expect(result.current.allColumns[0]).toBe('email')
    expect(result.current.allColumns[2]).toBe('name')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    act(() => result.current.setColumnVisibility('email', false))
    const saved = JSON.parse(localStorage.getItem('test-columns')!)
    expect(saved.visible).not.toContain('email')
  })

  it('restores from localStorage', () => {
    localStorage.setItem('test-columns', JSON.stringify({
      visible: ['name', 'age'],
      order: ['age', 'name', 'email', 'hidden'],
    }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).toEqual(['age', 'name'])
  })

  it('prunes removed columns from saved state', () => {
    localStorage.setItem('test-columns', JSON.stringify({
      visible: ['name', 'deleted_col'],
      order: ['name', 'deleted_col', 'email'],
    }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).not.toContain('deleted_col')
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-columns', JSON.stringify({ visible: 'not-an-array' }))
    const { result } = renderHook(() => useColumns({ columns, storageKey: 'test' }))
    expect(result.current.visibleColumns).toEqual(['name', 'email', 'age'])
  })
})
```

- [ ] **Step 3: Write useFilter.test.tsx**

Create `src/hooks/useFilter.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilter } from './useFilter'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { name: 'Alice', amount: 100 },
  { name: 'Bob', amount: 200 },
  { name: 'Charlie', amount: 50 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useFilter', () => {
  it('returns all data when no conditions exist', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))
    expect(result.current.filteredData).toEqual(data)
    expect(result.current.activeCount).toBe(0)
  })

  it('adds and removes conditions', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))

    act(() => result.current.addCondition(result.current.root.id, 'name'))
    expect(result.current.activeCount).toBe(1)

    const conditionId = result.current.root.conditions[0].id
    act(() => result.current.removeCondition(result.current.root.id, conditionId))
    expect(result.current.activeCount).toBe(0)
  })

  it('filters data when condition has a value', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))

    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const conditionId = result.current.root.conditions[0].id
    act(() =>
      result.current.updateCondition(result.current.root.id, conditionId, {
        operator: 'contains',
        value: 'ali',
      }),
    )
    expect(result.current.filteredData).toHaveLength(1)
    expect(result.current.filteredData[0].name).toBe('Alice')
  })

  it('toggles enabled state', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))

    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const conditionId = result.current.root.conditions[0].id
    act(() =>
      result.current.updateCondition(result.current.root.id, conditionId, {
        operator: 'contains',
        value: 'ali',
      }),
    )
    expect(result.current.filteredData).toHaveLength(1)

    act(() => result.current.setEnabled(false))
    expect(result.current.filteredData).toEqual(data) // disabled, all data returned
  })

  it('adds nested groups up to MAX_DEPTH', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))

    act(() => result.current.addGroup(result.current.root.id))
    expect(result.current.root.groups).toHaveLength(1)

    const subGroupId = result.current.root.groups[0].id
    act(() => result.current.addGroup(subGroupId))
    expect(result.current.root.groups[0].groups).toHaveLength(1)

    // Trying to add a 4th level should be ignored (MAX_DEPTH = 3)
    const subSubGroupId = result.current.root.groups[0].groups[0].id
    act(() => result.current.addGroup(subSubGroupId))
    expect(result.current.root.groups[0].groups[0].groups).toHaveLength(0)
  })

  it('clears all conditions', () => {
    const { result } = renderHook(() => useFilter({ data, columns }))

    act(() => result.current.addCondition(result.current.root.id, 'name'))
    act(() => result.current.addCondition(result.current.root.id, 'amount'))
    expect(result.current.activeCount).toBe(2)

    act(() => result.current.clearAll())
    expect(result.current.activeCount).toBe(0)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    act(() => result.current.addCondition(result.current.root.id, 'name'))
    const saved = JSON.parse(localStorage.getItem('test-filters')!)
    expect(saved.root.conditions).toHaveLength(1)
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('test-filters', 'not valid json')
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    expect(result.current.activeCount).toBe(0)
    expect(result.current.filteredData).toEqual(data)
  })

  it('falls back to defaults when localStorage has wrong shape', () => {
    localStorage.setItem('test-filters', JSON.stringify({ root: 'not-a-group', enabled: 42 }))
    const { result } = renderHook(() => useFilter({ data, columns, storageKey: 'test' }))
    expect(result.current.activeCount).toBe(0)
  })
})
```

- [ ] **Step 4: Write useSearch.test.tsx**

Create `src/hooks/useSearch.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from './useSearch'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
]

const data = [
  { name: 'Alice', email: 'alice@test.com' },
  { name: 'Bob', email: 'bob@test.com' },
]

describe('useSearch', () => {
  it('returns all data when query is empty', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    expect(result.current.filteredData).toEqual(data)
  })

  it('filters data when query is set', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    act(() => result.current.setQuery('alice'))
    expect(result.current.filteredData).toHaveLength(1)
    expect(result.current.filteredData[0].name).toBe('Alice')
  })

  it('clears search', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    act(() => result.current.setQuery('alice'))
    expect(result.current.filteredData).toHaveLength(1)
    act(() => result.current.clearSearch())
    expect(result.current.filteredData).toEqual(data)
  })

  it('query state is readable', () => {
    const { result } = renderHook(() => useSearch({ data, columns }))
    expect(result.current.query).toBe('')
    act(() => result.current.setQuery('test'))
    expect(result.current.query).toBe('test')
  })
})
```

- [ ] **Step 5: Run all hook tests**

Run: `npx vitest run src/hooks/`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSort.test.tsx src/hooks/useColumns.test.tsx src/hooks/useFilter.test.tsx src/hooks/useSearch.test.tsx
git commit -m "test: add hook tests for useSort, useColumns, useFilter, useSearch"
```

---

## Task 11: Tests — DataTable integration and Content component

**Files:**
- Create: `src/components/DataTable.test.tsx`
- Create: `src/components/Content.test.tsx`

- [ ] **Step 1: Write DataTable.test.tsx**

Create `src/components/DataTable.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
  { id: '3', name: 'Charlie', amount: 50 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('DataTable', () => {
  it('renders preset="full" with search, toolbar, content, and footer', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText(/3 of 3 records/)).toBeInTheDocument()
  })

  it('renders preset="minimal" without toolbar', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders preset="none" with custom children', () => {
    render(
      <DataTable columns={columns} data={data} rowKey="id" preset="none">
        <DataTable.Content />
      </DataTable>
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} rowKey="id" preset="full" />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
  })

  it('does not crash with empty columns', () => {
    render(<DataTable columns={[]} data={data} rowKey="id" preset="full" />)
    // Should render without crashing
    expect(screen.getByText(/0 of 3 records/)).toBeInTheDocument()
  })

  it('fires onRowClick with the correct row', () => {
    const onClick = vi.fn()
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" onRowClick={onClick} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(onClick).toHaveBeenCalledWith(data[0])
  })

  it('fires onRowClick via keyboard Enter', () => {
    const onClick = vi.fn()
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" onRowClick={onClick} />)
    const row = screen.getByText('Alice').closest('tr')!
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledWith(data[0])
  })
})
```

- [ ] **Step 2: Write Content.test.tsx**

Create `src/components/Content.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from '../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
  { id: 'hidden', label: 'Hidden', type: 'text', visible: false },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
]

describe('Content', () => {
  it('renders only visible columns', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('sort header has scope="col" and aria-sort', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const nameHeader = screen.getByText('Name').closest('th')!
    expect(nameHeader).toHaveAttribute('scope', 'col')
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
  })

  it('sort header button triggers sort state change', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    // Sort headers are buttons inside th
    const sortButton = screen.getByRole('button', { name: /Name/i })
    fireEvent.click(sortButton)
    const nameHeader = sortButton.closest('th')!
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
  })

  it('sort header responds to keyboard Enter', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="minimal" />)
    const sortButton = screen.getByRole('button', { name: /Name/i })
    fireEvent.keyDown(sortButton, { key: 'Enter' })
    // Button handles Enter natively, so this should trigger sort
    const nameHeader = sortButton.closest('th')!
    expect(nameHeader.getAttribute('aria-sort')).not.toBe('none')
  })

  it('empty state row has valid colSpan', () => {
    render(<DataTable columns={columns} data={[]} rowKey="id" preset="minimal" />)
    const emptyCell = screen.getByText('No records found').closest('td')!
    const colSpanValue = parseInt(emptyCell.getAttribute('colspan') ?? '0')
    expect(colSpanValue).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/components/DataTable.test.tsx src/components/Content.test.tsx`
Expected: All tests pass

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/DataTable.test.tsx src/components/Content.test.tsx
git commit -m "test: add DataTable integration and Content component tests"
```

---

## Task 12: Tests — Toolbar components

**Files:**
- Create: `src/components/toolbar/toolbar.test.tsx`

- [ ] **Step 1: Write toolbar.test.tsx**

Create `src/components/toolbar/toolbar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from '../DataTable'
import type { ColumnDef } from '../../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'number' },
]

const data = [
  { id: '1', name: 'Alice', amount: 100 },
  { id: '2', name: 'Bob', amount: 200 },
]

beforeEach(() => {
  localStorage.clear()
})

describe('Search', () => {
  it('filters data when typing in search', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'Alice' } })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('shows clear button when search has value', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'test' } })
    const clearButton = screen.getByLabelText('Clear search')
    expect(clearButton).toBeInTheDocument()
  })

  it('clear button resets search', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const search = screen.getByPlaceholderText('Search...')
    fireEvent.change(search, { target: { value: 'Alice' } })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('ColumnToggle', () => {
  it('opens and closes column panel', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const columnsBtn = screen.getByText('Columns')
    expect(columnsBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(columnsBtn)
    expect(columnsBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: /column/i })).toBeInTheDocument()
  })

  it('closes panel on Escape', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Columns'))
    const dialog = screen.getByRole('dialog', { name: /column/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FilterToolbarButton', () => {
  it('has aria-haspopup and aria-expanded', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const filterBtn = screen.getByText('Filter')
    expect(filterBtn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(filterBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens filter panel on click', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Filter'))
    expect(screen.getByRole('dialog', { name: /filter/i })).toBeInTheDocument()
  })

  it('closes filter panel on Escape', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    fireEvent.click(screen.getByText('Filter'))
    const dialog = screen.getByRole('dialog', { name: /filter/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('GroupByToolbarButton', () => {
  it('has aria-haspopup and aria-expanded', () => {
    render(<DataTable columns={columns} data={data} rowKey="id" preset="full" />)
    const groupBtn = screen.getByText('Group')
    expect(groupBtn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false')
  })
})
```

- [ ] **Step 2: Run the toolbar tests**

Run: `npx vitest run src/components/toolbar/toolbar.test.tsx`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/toolbar/toolbar.test.tsx
git commit -m "test: add toolbar component tests for search, column toggle, filter, group-by"
```

---

## Task 13: Search debouncing

**Files:**
- Create: `src/hooks/useDebounce.ts`
- Modify: `src/hooks/useSearch.ts`

- [ ] **Step 1: Create useDebounce hook**

Create `src/hooks/useDebounce.ts`:

```ts
import { useState, useEffect } from 'react'

/** Debounce a value — returns the latest value after `delay` ms of inactivity. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
```

- [ ] **Step 2: Integrate debounce into useSearch**

Replace `src/hooks/useSearch.ts`:

```ts
import { useState, useMemo, useCallback } from 'react'
import type { RowData, ColumnDef } from '../types'
import { searchRecords } from '../lib/search'
import { useDebounce } from './useDebounce'

interface UseSearchOptions<T extends RowData> {
  data: T[]
  columns: ColumnDef<T>[]
}

export function useSearch<T extends RowData>({ data, columns }: UseSearchOptions<T>) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 150)

  const filteredData = useMemo(
    () => searchRecords(data, debouncedQuery, columns),
    [data, debouncedQuery, columns],
  )

  const clearSearch = useCallback(() => setQuery(''), [])

  return {
    query,
    setQuery,
    clearSearch,
    filteredData,
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass. Note: the useSearch tests use `act()` which flushes state, and the 150ms debounce uses `setTimeout`. Vitest with jsdom auto-advances timers in `act()`. If any search tests fail due to debounce timing, add `vi.useFakeTimers()` and `vi.advanceTimersByTime(200)` in the useSearch tests.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDebounce.ts src/hooks/useSearch.ts
git commit -m "feat: debounce search by 150ms for large dataset performance"
```

---

## Task 14: ESLint setup

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `eslint.config.js`

- [ ] **Step 1: Install ESLint dependencies**

Run:
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
```

- [ ] **Step 2: Create eslint.config.js**

Create `eslint.config.js`:

```js
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // The codebase uses `as` casts for RowData generics extensively
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
)
```

- [ ] **Step 3: Run lint**

Run: `npx eslint src/`
Expected: May have some warnings. Fix any errors (not warnings) before committing.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore: add ESLint with typescript-eslint and react-hooks plugin"
```

---

## Task 15: CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create CHANGELOG.md**

Create `CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-02-19

### Added

- Compound component `DataTable` with `preset="full"`, `"minimal"`, and `"none"` render modes
- Multi-level group-by with date period bucketing (day, week, month, quarter, year)
- Sum aggregation in group headers for number/currency columns
- Condition-based filtering with nested AND/OR groups
- Free-text search across searchable columns
- Column sorting with localStorage persistence
- Column visibility toggle with drag-to-reorder
- Date filter component
- File attachment adapter interface
- `defineTable()` and `defineColumns()` typed config helpers
- `dataTablePreset` Tailwind preset with `dt-*` design tokens
- Pre-built dark and light theme CSS files
- Standalone hooks: `useGroupBy`, `useSort`, `useSearch`, `useFilter`, `useColumns`
- Pure logic layer: `groupRecords`, `filterRecords`, `sortRecords`, `searchRecords`
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (old + new)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds, no errors

- [ ] **Step 4: Run lint**

Run: `npx eslint src/`
Expected: No errors (warnings acceptable)

- [ ] **Step 5: Verify test count increased**

Run: `npx vitest run`
Expected: Significantly more than the original 66 tests
