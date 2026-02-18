# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Build with tsup (ESM + CJS + .d.ts)
npm run dev            # Build in watch mode
npm run typecheck      # tsc --noEmit
npm test               # vitest run (all tests, single run)
npm run test:watch     # vitest (interactive watch mode)
npx vitest run src/lib/group-by.test.ts   # Run a single test file
```

## Package Overview

`@delta-and-beta/data-table` — a publishable React component library for data tables with multi-level grouping, search, sorting, column management, and attachments. Styled with Tailwind CSS using custom `dt-*` design tokens (CSS custom properties).

Peer dependencies: React 18+, Tailwind CSS 3+. Built with tsup, tested with vitest + @testing-library/react + jsdom.

## Architecture

### Compound Component Pattern

`DataTable` is the root component that wires together all hooks, builds a context value, and renders children. Sub-components are attached as static properties (`DataTable.Toolbar`, `DataTable.Content`, etc.) and consume shared state via `useDataTable()` context hook.

Three render modes:
- `preset="full"` — auto-renders toolbar (search, group-by, column toggle) + content + footer
- `preset="minimal"` — content + footer only
- `preset="none"` (default) — render your own layout using `children`

### Data Pipeline

Data flows through hooks in this order inside `DataTable`:
1. **useSearch** — filters `data` by query across searchable columns → `filteredData`
2. **useSort** — sorts `filteredData` → `sortedData`
3. **useColumns** — manages column visibility/order (does not transform data)
4. **useGroupBy** — groups `sortedData` into recursive `GroupedSection[]` tree → `groupedData`

Each hook is independently importable for custom composition outside `DataTable`.

### Pure Logic Layer (`src/lib/`)

Framework-agnostic functions with zero dependencies:
- `group-by.ts` — recursive multi-level grouping algorithm with date period bucketing and sum aggregation
- `sort.ts` — locale-aware comparison with null-last semantics
- `search.ts` — case-insensitive substring search across columns
- `format.ts` — Intl-based formatters for currency, dates, numbers

### State Persistence

Hooks (`useGroupBy`, `useColumns`, `useSort`) persist their state to `localStorage` keyed by `storageKey` prop. They validate saved state against current column definitions on load.

### Tailwind Integration

`src/tailwind.ts` exports `dataTablePreset` — a Tailwind config partial defining `dt-*` color tokens backed by CSS custom properties (e.g., `--dt-primary`). Consumers override via CSS variables. This is a separate entry point: `@delta-and-beta/data-table/tailwind`.

### Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

### Two Build Entry Points

tsup builds two entry points:
- `src/index.ts` — all components, hooks, types (externals: react, react-dom, tailwindcss)
- `src/tailwind.ts` — Tailwind preset only (external: tailwindcss)
