# Production Readiness Design

**Date:** 2026-04-04
**Goal:** Make `@delta-and-beta/data-table` production-ready across robustness, accessibility, testing, and tooling. Internal-first with open-source ambitions. No CI workflows — code-level changes only.

## Constraints

- Dependencies are fine if justified, but keep them minimal
- No CI workflow files — just make scripts CI-friendly
- No visual regression testing
- No Storybook / demo app

---

## Section 1: Bug Fixes & Edge Case Guards

### 1a. search.ts logic bug

**File:** `src/lib/search.ts`
**Bug:** When all columns have `searchable: false`, the fallback at line 21 searches ALL columns anyway, violating user intent.
**Fix:** When no searchable columns exist, return the full dataset unfiltered. "No searchable columns" means "search is disabled," not "search everything."

### 1b. Content.tsx colSpan=0

**File:** `src/components/Content.tsx`
**Bug:** When all columns are hidden via ColumnToggle, `visibleColumns.length` is 0, producing `colSpan={0}` on the empty-state row — invalid HTML.
**Fix:** `colSpan={Math.max(visibleColumns.length, 1)}`.

### 1c. localStorage corruption recovery

**Files:** All hooks that read localStorage (`useSort`, `useColumns`, `useGroupBy`, `useFilter`)
**Problem:** Hooks parse localStorage JSON but don't validate the shape. A non-array `visible` field, missing `collapsed` array, or corrupt `direction` string cause runtime errors that escape the try/catch.

**Fix:** Add a `safeParse` utility or inline validation in each hook:

| Hook | Validates |
|------|-----------|
| `useSort` | `field` is string, `direction` is `'asc'` or `'desc'` |
| `useColumns` | `visible` and `order` are string arrays |
| `useGroupBy` | `groups` is array of objects, `collapsed` is array |
| `useFilter` | `root` has expected FilterGroup shape, `enabled` is boolean |

On validation failure, fall through to defaults silently (same as JSON parse failure).

### 1d. Row key collisions

**File:** `src/components/Content.tsx`
**Bug:** Falls back to array index when `row[rowKey]` is null. After filtering, indices can collide across different render passes.
**Fix:** Use composite key `row-${index}` for the fallback.

---

## Section 2: Error Boundary & Dev Warnings

### 2a. DataTableErrorBoundary

**New file:** `src/components/ErrorBoundary.tsx`

A React class component (error boundaries require class components) that:
- Catches render errors in the DataTable subtree
- Displays a minimal fallback: styled div with "Table failed to render" and the error message in dev mode
- Internal only — not exported. `DataTable` wraps its children in this boundary automatically
- Consumers who want custom error UI wrap `<DataTable>` in their own boundary (React boundaries cascade outward)

### 2b. Dev-mode validation warnings

**New file:** `src/lib/dev-warn.ts`

A `devWarn(condition: boolean, message: string)` utility that calls `console.warn` only when `process.env.NODE_ENV !== 'production'`. Tree-shaken out of production builds by bundlers.

**Warnings added to `DataTable.tsx` on mount (via useEffect, fires once):**

| Condition | Message |
|-----------|---------|
| `rowKey` not present on `data[0]` | `DataTable: rowKey "${rowKey}" not found on data items` |
| `columns` is empty | `DataTable: columns array is empty` |
| `storageKey` is `""` | `DataTable: storageKey is empty string, localStorage persistence disabled` |
| `defaultSort.field` doesn't match any column | `DataTable: defaultSort field "${field}" not found in columns` |

---

## Section 3: Accessibility

### 3a. Table semantics

**File:** `src/components/Content.tsx`

- Add `scope="col"` to all `<th>` elements
- Add `aria-sort="ascending" | "descending" | "none"` to sortable header cells
- Wrap sortable header content in a `<button>` inside the `<th>` (semantically correct, avoids `role="button"` on `<th>`)

### 3b. Interactive rows & group headers

**File:** `src/components/Content.tsx` (rows), `src/components/headers/GroupHeader.tsx` (groups)

- Clickable rows: add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space. Only when `onRowClick` is provided.
- Group header toggle: add `role="button"`, `tabIndex={0}`, `aria-expanded={!isCollapsed}`, `onKeyDown` for Enter/Space on the clickable cell.

### 3c. Toolbar dropdowns

**Files:** `ColumnToggle.tsx`, `GroupByConfigPanel.tsx`, `FilterConfigPanel.tsx`

All three get the same treatment:

| Attribute | Where |
|-----------|-------|
| `aria-haspopup="dialog"` | Trigger button |
| `aria-expanded={open}` | Trigger button |
| `role="dialog"` | Panel container |
| `aria-label` | Panel container (describing purpose) |
| `onKeyDown` Escape handler | Panel container |
| Focus first element on open | `useEffect` in panel |
| Return focus to trigger on close | `useEffect` cleanup or close handler |

**No full focus trapping.** These are lightweight dropdown panels with backdrop click-to-close, not modal dialogs. If users tab past the panel, the backdrop closes it naturally.

### 3d. Keyboard drag-to-reorder alternative

**Files:** `GroupByConfigPanel.tsx`, `ColumnToggle.tsx`

Add "move up" / "move down" icon buttons next to each draggable item. Small, always visible, work for keyboard and touch. Mouse drag behavior stays as-is.

### 3e. Search clear button

**File:** `src/components/toolbar/Search.tsx`

Add `aria-label="Clear search"` to the clear button.

---

## Section 4: Tests

### 4a. Pure logic tests

**`src/lib/sort.test.ts`** (new):
- Null/undefined sort last in both directions
- Numeric comparison (not string-based)
- String locale comparison with `numeric: true`
- Mixed types fall through to string comparison
- Empty string vs null ordering
- Descending reversal

**`src/lib/search.test.ts`** (new):
- Substring match across text columns
- Case insensitivity
- Null/undefined values skipped
- Empty query returns all records
- Bug fix: all columns `searchable: false` returns all records unfiltered
- Column type filtering (text/custom default, `searchable: true` override)

### 4b. Hook tests

**`src/hooks/useSort.test.ts`** (new):
- Sort by field, toggle direction on same-field click
- New field click resets to ascending
- Persist to / restore from localStorage
- Corrupted localStorage falls back to defaults

**`src/hooks/useColumns.test.ts`** (new):
- Columns default to visible
- Toggle visibility, persist to localStorage
- Reorder columns
- Corrupted localStorage recovery
- Removed columns pruned from saved state

**`src/hooks/useFilter.test.ts`** (new):
- Add/remove conditions, toggle enabled
- Nested groups with AND/OR
- Persist to / restore from localStorage
- MAX_DEPTH enforcement
- Corrupted localStorage recovery

**`src/hooks/useSearch.test.ts`** (new):
- Query updates filteredData
- clearSearch resets

### 4c. Component integration tests

**`src/components/DataTable.test.tsx`** (new):
- Renders with `preset="full"`, `"minimal"`, `"none"` with children
- Empty data shows empty state
- Empty columns array doesn't crash
- Pipeline order: filter -> search -> sort -> group
- `onRowClick` fires with correct row

**`src/components/Content.test.tsx`** (new):
- Renders visible columns only
- Sort header click triggers sort change
- Keyboard Enter/Space on sort header
- Group header expand/collapse
- Empty state row has valid colSpan

### 4d. Toolbar tests

**`src/components/toolbar/toolbar.test.tsx`** (new):
- Search input filters data
- ColumnToggle opens/closes, toggles visibility
- Escape closes open panels
- FilterConfigPanel add/remove condition

### 4e. Out of scope for tests

- Individual ARIA attribute assertions (covered implicitly by component render tests)
- Drag-and-drop (jsdom doesn't support DragEvent, move up/down buttons cover the logic)
- Visual/CSS correctness

---

## Section 5: Search Debouncing & Tooling

### 5a. Search debouncing

**New hook:** `src/hooks/useDebounce.ts` (~10 lines, no new dependency)

`useSearch` debounces the query by 150ms before filtering. The input stays responsive (controlled by raw state), but `searchRecords()` only runs after the user pauses typing.

### 5b. ESLint setup

**New dev dependencies:** `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`

**New file:** `eslint.config.js` (flat config):
- TypeScript-aware recommended rules from typescript-eslint
- React hooks lint rules
- No style/formatting rules

### 5c. CHANGELOG.md

**New file:** `CHANGELOG.md`

[Keep a Changelog](https://keepachangelog.com/) format. Single entry for v0.1.0 summarizing current features. Future releases append sections. No automated release tooling.

---

## New files summary

| File | Purpose |
|------|---------|
| `src/components/ErrorBoundary.tsx` | Internal error boundary |
| `src/lib/dev-warn.ts` | Dev-mode console.warn utility |
| `src/hooks/useDebounce.ts` | Simple debounce hook for search |
| `src/lib/sort.test.ts` | Sort logic tests |
| `src/lib/search.test.ts` | Search logic tests |
| `src/hooks/useSort.test.ts` | Sort hook tests |
| `src/hooks/useColumns.test.ts` | Columns hook tests |
| `src/hooks/useFilter.test.ts` | Filter hook tests |
| `src/hooks/useSearch.test.ts` | Search hook tests |
| `src/components/DataTable.test.tsx` | Integration tests |
| `src/components/Content.test.tsx` | Content component tests |
| `src/components/toolbar/toolbar.test.tsx` | Toolbar component tests |
| `eslint.config.js` | ESLint flat config |
| `CHANGELOG.md` | Changelog |

## Modified files summary

| File | Changes |
|------|---------|
| `src/lib/search.ts` | Fix searchable fallback bug |
| `src/lib/dev-warn.ts` | New utility |
| `src/components/Content.tsx` | colSpan fix, ARIA attributes, keyboard nav, row key fix |
| `src/components/DataTable.tsx` | ErrorBoundary wrapper, dev warnings |
| `src/components/headers/GroupHeader.tsx` | ARIA expanded, keyboard nav |
| `src/components/toolbar/Search.tsx` | aria-label on clear button |
| `src/components/toolbar/ColumnToggle.tsx` | ARIA, Escape, focus management, move up/down buttons |
| `src/components/toolbar/GroupByConfigPanel.tsx` | ARIA, Escape, focus management, move up/down buttons |
| `src/components/toolbar/FilterConfigPanel.tsx` | ARIA, Escape, focus management |
| `src/components/toolbar/FilterToolbarButton.tsx` | aria-haspopup, aria-expanded |
| `src/components/toolbar/GroupByToolbarButton.tsx` | aria-haspopup, aria-expanded |
| `src/hooks/useSort.ts` | localStorage validation |
| `src/hooks/useColumns.ts` | localStorage validation |
| `src/hooks/useGroupBy.ts` | localStorage validation |
| `src/hooks/useFilter.ts` | localStorage validation |
| `src/hooks/useSearch.ts` | Debounced search integration |
| `package.json` | ESLint dev dependencies |

## Implementation order

1. Bug fixes (Section 1) — foundation, everything else depends on correct behavior
2. Error boundary & dev warnings (Section 2) — safety net before adding complexity
3. Accessibility (Section 3) — modifies component APIs that tests will assert against
4. Tests (Section 4) — written against the final component behavior
5. Tooling (Section 5) — ESLint, debounce, changelog last (independent of other sections)
