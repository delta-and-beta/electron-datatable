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
```

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
2. **useSearch** — free-text search across searchable columns (150ms debounce) → `search.filteredData`
3. **useSort** — sorts search results → `sort.sortedData`
4. **useColumns** — manages column visibility/order (does not transform data)
5. **useGroupBy** — groups sorted data into recursive `GroupedSection[]` tree → `groupBy.groupedData`

Each hook is independently importable for custom composition outside `DataTable`.

### Pure Logic Layer (`src/lib/`)

Framework-agnostic functions with zero dependencies:
- `group-by.ts` — recursive multi-level grouping algorithm with date period bucketing and sum aggregation
- `filter.ts` — condition-based filtering engine with nested groups and typed operators
- `sort.ts` — locale-aware comparison with null-last semantics
- `search.ts` — case-insensitive substring search across columns
- `format.ts` — Intl-based formatters for currency, dates, numbers
- `format-aggregate.ts` — formatting for aggregation values in group headers
- `dev-warn.ts` — development-only console warnings (tree-shaken out of prod)
- `utils.ts` — `cn()` utility combining `clsx` + `tailwind-merge` for class merging

### State Persistence

Hooks (`useGroupBy`, `useColumns`, `useSort`, `useFilter`) persist their state to `localStorage` keyed by `storageKey` prop. They validate saved state against current column definitions on load (orphaned columns are removed).

localStorage key patterns:
- `{storageKey}-sort` — `{ field, direction }`
- `{storageKey}-filters` — `{ root, enabled }`
- `{storageKey}-groupby` — `{ groups, collapsed, showEmpty }`
- `{storageKey}-columns` — `{ visible, order }`

### Tailwind Integration

`src/tailwind.ts` exports `dataTablePreset` — a Tailwind config partial defining `dt-*` color tokens backed by CSS custom properties (e.g., `--dt-primary`). Consumers override via CSS variables. This is a separate entry point: `@delta-and-beta/electron-datatable/tailwind`. Pre-built dark/light themes ship as CSS files in `dist/themes/`.

### Build Outputs

The full `npm run build` chains three steps:
1. **tsup** — two entry points (`src/index.ts` for components/hooks, `src/tailwind.ts` for the preset) → ESM + CJS + `.d.ts`
2. **tailwindcss** — compiles `src/styles-input.css` (just `@tailwind utilities`) through `tailwind.build.config.ts` → `dist/styles.css`
3. **Copy themes** — copies `src/themes/*.css` (dark/light token presets) into `dist/themes/`

Three export paths in `package.json`:
- `"."` → components, hooks, types
- `"./tailwind"` → Tailwind preset only
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
