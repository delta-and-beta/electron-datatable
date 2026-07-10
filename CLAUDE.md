# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Full build: tsup (ESM + CJS + .d.ts) → tailwindcss → copy theme CSS
npm run dev            # tsup watch mode (JS/TS only, does not rebuild CSS)
npm run typecheck      # tsc --noEmit
npm test               # vitest run (all tests, single run)
npm run test:watch     # vitest (interactive watch mode)
npm run lint           # eslint src/
npx vitest run src/lib/group-by.test.ts   # Run a single test file
node e2e/test-e2e.mjs  # Screenshot-based E2E (standalone Electron app, separate node_modules)
```

`npm run dev` rebuilds JS/TS only — CSS is not watched, so re-run `npm run build` after touching Tailwind utilities or theme tokens.

## Package Overview

`@delta-and-beta/electron-datatable` — a publishable React component library for data tables with multi-level grouping, search, sorting, filtering, column management, and attachments. Styled with Tailwind CSS using custom `dt-*` design tokens (CSS custom properties).

Peer dependencies: React 18+, Tailwind CSS 3+. Built with tsup, tested with vitest + @testing-library/react + jsdom.

## Architecture

### Compound Component Pattern

`DataTable` is the root component that wires together all hooks, builds a context value, and renders children via `DataTableProvider`. Sub-components are attached as static properties using `Object.assign` on `DataTableRoot`, and consume shared state via `useDataTable()` context hook.

Available sub-components: `DataTable.Toolbar`, `DataTable.Content`, `DataTable.Footer`, `DataTable.Search`, `DataTable.Filter`, `DataTable.FilterPanel`, `DataTable.GroupBy`, `DataTable.GroupByPanel`, `DataTable.ColumnToggle`, `DataTable.DateFilter`, `DataTable.GroupHeader`.

Three render modes:
- `preset="full"` — auto-renders toolbar (search, filter, group-by, column toggle) + content + footer
- `preset="minimal"` — content + footer only
- `preset="none"` (default) — render your own layout using `children`

### `defineTable` — Recommended DX Entry Point

`defineTable<T>()` accepts an object-keyed column config (column IDs inferred from keys) and returns `{ columns, rowKey, storageKey, defaultSort, defaultGroupBy }` — designed to spread directly onto `<DataTable>`. Column IDs are constrained to `keyof T & string`. A simpler `defineColumns<T>()` is also exported as an identity function for array-based column definitions.

### Data Pipeline

Data flows through hooks in this order inside `DataTable`:
1. **useFilter** — condition-based filtering with nested AND/OR groups → `filter.filteredData`
2. **DateFilter (inline)** — `DataTable` applies the active `dateFilter` directly between filter and search (not its own hook) → date-filtered rows
3. **useSearch** — free-text search across searchable columns (150ms debounce) → `search.filteredData`
4. **useSort** — multi-field sort via `sortRecordsMulti` → `sort.sortedData`
5. **useColumns** — manages column visibility, order, and **per-column widths** (does not transform data)
6. **useGroupBy** — groups sorted data into recursive `GroupedSection[]` tree → `groupBy.groupedData`

Each hook is independently importable for custom composition outside `DataTable`.

The context value exposes both `columns` (visible, ordered columns for rendering) and `filterColumns` (the full column set used to build filter/group/sort UIs) — keep these distinct when adding context consumers.

### Pure Logic Layer (`src/lib/`)

Framework-agnostic functions with zero dependencies:
- `group-by.ts` — recursive multi-level grouping algorithm with date period bucketing and sum aggregation
- `filter.ts` — condition-based filtering engine with nested groups and typed operators
- `sort.ts` — locale-aware comparison with null-last semantics; `sortRecordsMulti` applies an ordered `SortLevel[]` (multi-field tie-breaking)
- `search.ts` — case-insensitive substring search across columns
- `format.ts` — Intl-based formatters for currency, dates, numbers
- `format-aggregate.ts` — formatting for aggregation values in group headers
- `ordinal-vocabularies.ts` — built-in ordered vocabularies (weekdays, months, sizes, etc.) used to auto-detect ordinal columns so group sections sort semantically rather than alphabetically
- `matching-utils.ts` — `fileToBase64`, `filterByMimeType`, `DEFAULT_ACCEPTED_TYPES` (shared by the matching plugin; lives in core lib but only consumed via `/matching`)
- `dev-warn.ts` — development-only console warnings (tree-shaken out of prod)
- `utils.ts` — `cn()` utility combining `clsx` + `tailwind-merge` for class merging

### Rendering Layer

- `components/table/` — low-level table primitives (`Table`, `TableRow`, `TableHead`, `TableCell`, …), exported publicly. `Table` uses **`table-layout: fixed`**; column widths come exclusively from the `<colgroup>` that `Content` renders (never from per-cell width styles). The primitives also render the vertical **column grid borders** across header, data, and group rows; the last column is excluded so there is no trailing edge line.
- `components/Content.tsx` — orchestrates row/group rendering on top of the table primitives. Grouped first-column indent is *added* to the 16px cell baseline (`16 + 24 + (levels − 1) × 14`), so grouping never shifts content left of the column header. Grouped rows carry a left accent rail (`headers/group-style.ts`) on their first rendered cell.
- `components/headers/GroupHeader.tsx` — level-aware group header. The label band spans the leading run of non-aggregatable columns (colSpan); the disclosure is a real `<button>` in the first cell (sums included in its aria-label). Sticky positioning uses a window capture-phase scroll listener, level-tagged sentinels, and measured per-level heights (reported to `Content` via `onHeightChange`) so **nested headers stack below their ancestors** while scrolling; only a following header at the same or shallower level pushes a stuck header out.
- **Resizable columns**: dragging a header cell's right edge (pointer events) calls `useColumns.setColumnWidth`; the width lands on the `<col>` element so all row layers follow, and persists per-table.
- **Collapse paths** are `/`-joined with percent-escaped segments (`lib/group-path.ts`) so group values containing `/` can't collide.

### State Persistence

Hooks (`useGroupBy`, `useColumns`, `useSort`, `useFilter`) persist their state to `localStorage` keyed by `storageKey` prop. They validate saved state against current column definitions on load (orphaned columns are removed).

localStorage key patterns:
- `{storageKey}-sort` — `SortLevel[]` (ordered array of `{ field, direction }`; multi-field)
- `{storageKey}-filters` — `{ root, enabled }`
- `{storageKey}-groupby` — `{ groups, collapsed, showEmpty }`
- `{storageKey}-columns` — `{ visible, order, widths }` (`widths` is a `Record<columnId, px>`)

### Tailwind Integration

`src/tailwind.ts` exports `dataTablePreset` — a Tailwind config partial defining `dt-*` color tokens backed by CSS custom properties (e.g., `--dt-primary`). Consumers override via CSS variables. This is a separate entry point: `@delta-and-beta/electron-datatable/tailwind`. Pre-built dark/light themes ship as CSS files in `dist/themes/`.

### Bulk Matching Plugin (`src/matching.ts`)

A separate entry point (`@delta-and-beta/electron-datatable/matching`) providing bulk file drop → OCR → match → confirm → attach orchestration. Core DataTable never imports from matching — one-way dependency.

Key pieces:
- `MatchingAdapter<T>` — consumer provides `ocr()`, `match()`, `summarize()` backends
- `useMatching` hook — full state machine: `idle → reading → ocr → matching → duplicates → reviewing → attaching → done | error`
- `MatchingProvider` / `useMatchingContext()` — separate React context (not in DataTable's context)
- `MatchingDataTable` — drop-in wrapper composing DataTable + BulkDropZone + MatchingReportDialog
- `matchingDialogWrapper` prop — lets consumers wrap dialog content in their own shell (e.g., shadcn `<Dialog>`)
- Matching state is session-only (no localStorage persistence). `reset()` clears everything.
- `useMatching` also exposes `getRowDropHandlers(rowId)` (with `dropTargetRowId` for highlight): a **single** valid file dropped on a row goes straight to `AttachmentAdapter.add()`; **2+** files dropped on a row escalate into the bulk matching flow. The same single-vs-bulk rule applies to the full-table `BulkDropZone`.

### Build Outputs

The full `npm run build` chains three steps:
1. **tsup** — three entry points (`src/index.ts` for components/hooks, `src/tailwind.ts` for the preset, `src/matching.ts` for bulk matching) → ESM + CJS + `.d.ts`
2. **tailwindcss** — compiles `src/styles-input.css` (just `@tailwind utilities`) through `tailwind.build.config.ts` → `dist/styles.css`
3. **Copy themes** — copies `src/themes/*.css` (dark/light token presets) into `dist/themes/`

Four export paths in `package.json`:
- `"."` → components, hooks, types
- `"./tailwind"` → Tailwind preset only
- `"./matching"` → matching types, hook, components, utilities
- `"./styles.css"`, `"./themes/dark.css"`, `"./themes/light.css"` → CSS files

### Testing

Tests use vitest with jsdom environment. `@testing-library/jest-dom` matchers are globally available via `src/test-setup.ts`. Pure logic tests live alongside their modules (`src/lib/*.test.ts`); component tests alongside components (`*.test.tsx`).

E2E tests live in `e2e/` — a standalone Electron app that renders the DataTable, uses esbuild to bundle, and Chrome DevTools Protocol (CDP) for screenshot-based verification. Run via `e2e/test-e2e.mjs`.

### Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

### Non-Obvious Behaviors

- **Incomplete filter conditions are no-ops**: a `FilterCondition` with no `value` returns `true` (treated as "not yet configured").
- **Empty groups sort to end**: the `'(Empty)'` group key is always pushed to the bottom regardless of sort direction.
- **Date period bucketing happens before grouping**: dates are bucketed (month, quarter, etc.) *then* grouped recursively.
- **Null-last sorting**: null/undefined values always sort to the end, regardless of ascending/descending.
- **Auto-sum in groups**: columns with `type: 'number'` or `type: 'currency'` are automatically summed in group headers unless `sumInGroup: false`.
- **Dev-mode validation**: `DataTableRoot` runs `devWarn()` checks on mount (empty columns, missing rowKey, orphaned defaultSort field).
- **ErrorBoundary is class-based**: wraps the root `DataTable` because React has no hooks-based error boundary equivalent.
