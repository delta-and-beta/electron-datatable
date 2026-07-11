# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.8.0] - 2026-07-11

### Added

- **Data sync layer** (`@delta-and-beta/electron-datatable/sync`). Airtable-style
  one-way sync from external stores: `SyncAdapter` contract with dependency-
  injected structural clients (no bundled drivers), `SyncEngine` with two-phase
  `dryRun()`/`commit()`, upsert-by-externalId into a consumer-owned `SyncTarget`,
  per-run results, progress reporting, and deletion policies. Adapters for
  SQLite, PostgreSQL, DynamoDB, and BigQuery; `inferColumns()` maps source
  schemas to column definitions; `SyncStatusChip`/`useSyncStatus` surface sync
  state in the toolbar. Core never imports from `/sync` (boundary-tested).

## [0.7.0] - 2026-07-11

### Added

- **Batch selection & bulk actions.** `bulkActions: BulkAction<T>[]` enables a
  frozen-aware checkbox column, select-all-visible (indeterminate on partial),
  shift-click range selection, and a floating action bar operating on the
  typed selected rows. Selection clears on filter/search/view-mode changes.

### Fixed

- Kanban moves now reconcile optimistic lanes with authoritative data, clear
  completed moves, and report rejected or synchronously thrown moves through
  `onMoveError`. The synthetic "Uncategorized" lane has an internal key and is
  intentionally not a drop target.
- Frozen-column offsets follow measured header geometry, including after
  resize and column-set changes.
- Named views persist the active view across save/switch and reload saved row
  height and view mode without overwriting unsaved working facets. Malformed
  legacy grouping state is ignored, and newly defined columns are appended
  when older view snapshots are restored.

## [0.6.0] - 2026-07-11

### Added

- **Named views.** Save, switch, rename, duplicate, delete, and set-default
  table views — a view captures sort, filters, grouping, column state
  (including frozen count), view mode, and row height. `useViews` +
  `ViewsMenu` exported; a Views popover ships in the full-preset toolbar.
  Existing per-facet localStorage state is migrated into a "Default" view on
  first run — nothing is lost. Search is intentionally not part of a view.
- **Row height density.** `rowHeight: 'short' | 'medium' | 'tall'`, part of
  the view payload.

## [0.5.0] - 2026-07-11

### Added

- **Kanban view.** `KanbanBoard` compound component driven by the existing
  group-by pipeline (first level = lanes), plus `viewMode: 'table' | 'kanban'`
  on the full preset with a toolbar toggle and per-storageKey persistence.
  `defineTable` gains a `kanban` config: `laneField` sugar, `laneOrder`,
  card fields rendered through the column formatting pipeline, `laneAggregate`
  (currency-aware), and optimistic `onMove` with rollback. Unmatched rows
  appear in an "Uncategorized" lane. Native HTML5 drag & drop — no new deps.

## [0.4.0] - 2026-07-11

### Added

- **Portaled `Popover` primitive.** All toolbar panels (Sort, Filter, Group,
  Columns) now render through one portal-to-body popover with two-axis
  collision handling: vertical flip, horizontal clamp, re-measure on
  scroll/resize/content change, Tab/Shift-Tab focus cycling, and Esc-to-close.
  Panels are capped to the viewport and scroll internally, so long content no
  longer overflows the viewport or clips under ancestor `overflow`.
- **Frozen leading columns.** `frozenColumns?: number` on `DataTable`/
  `defineTable` pins the first N visible columns with cumulative sticky
  offsets, opaque themed backgrounds, and a right-edge divider. The frozen
  count persists with column state.

### Fixed

- Body cells now respect user-resized column widths (previously only headers
  did), so column resize and sticky offsets stay aligned.

## [0.3.0] - 2026-07-11

### Added

- **Theming API.** Export `DtThemeToken`, `DataTableThemeTokens`,
  `applyDataTableTheme`, `setDataTableThemeMode`, and `getDataTableThemeMode`
  for typed runtime skinning and dark/light mode selection.
- **Badge palette tokens.** Status badge foregrounds and derived translucent
  backgrounds now use seven independently configurable `--dt-badge-*` tokens.

### Changed

- Theme files now use `[data-dt-theme='dark']` and
  `[data-dt-theme='light']` selectors so both modes can be imported together.
  If you imported `themes/dark.css` and relied on `:root` scoping, set
  `data-dt-theme='dark'` on `<html>` or rely on the built-in dark defaults.

## [0.2.0] - 2026-07-11

Consumer-lessons release — upstreams the patterns every company-app tab was
hand-rolling (see company-app docs/superpowers/specs/2026-07-10-datatable-upstream-design.md).

### Added

- **Plain-object row generics.** `DataTable`/`defineTable` accept any `T extends object` —
  the `as unknown as (T & RowData)[]` consumer cast is gone; `onRowClick(row: T)` is domain-typed.
- **Minor-units currency columns.** `type:'currency'` columns take `minorUnits`,
  `decimalPlaces`, `symbol`; body cells auto-format; `formatCurrency`/`formatNumber`/`formatDate` exported.
- **StatusBadge + declarative badge columns.** Exported `StatusBadge`, `BadgeVariant`
  union, and `ColumnDef.badgeVariants` value→variant maps.
- **First-class row actions.** `actions: RowAction<T>[]` on `DataTable`/`defineTable`
  (plus `makeActionsColumn`) — right-aligned icon buttons with stopPropagation and per-row `show`.
- **Tags columns.** `type:'tags'` for `string[]` values: pill rendering, `contains_any` /
  `contains_all` / `is_empty` filtering with a multi-select filter UI.
- **KPI footer tiles.** `footerKpis: FooterKpi[]` renders label/value tiles in the footer bar.

### Fixed

- Ship working alpha-tinted `dt-*` backgrounds, borders, hover states, and muted text.
- Accept plain-object row generics from the `/matching` entry point.
- Keep consumer `actions` columns configurable and distinct from generated row actions.
- Normalize currency decimal places to an integer from 0 through 20.
- Prevent group updates from selecting non-groupable tags columns.
- Place negative signs before custom currency symbols.
- Use tabular numerals for number and currency body cells.

## [0.1.8] - 2026-06-01

### Added

- **Resizable columns.** Drag the right edge of any column header to set its
  width; the chosen widths persist per-table (localStorage) and survive reloads.
  The header-cell width drives the whole column. `useColumns` now exposes
  `widths` and `setColumnWidth`.

## [0.1.7] - 2026-06-01

### Changed

- Column grid borders now render on data rows and the header too (not only group
  rows), driven by the `Table` primitive — a consistent vertical grid across the
  whole table. The last column is excluded so there is no trailing edge line.
- The group-header record count is now a plain right-aligned number (removed the
  circular ring/pill around it).

## [0.1.6] - 2026-06-01

### Added

- **Filter value dropdown.** A new `ColumnDef.options` lets a column declare a
  predefined choice set; when present, the filter condition row renders a value
  dropdown (Airtable-style) that pre-selects the current value, instead of a
  free-text input. Text columns already expose `is` / `is not`, so single-select
  filtering reads naturally (e.g. *stage is not Closed - No-Go*).

## [0.1.5] - 2026-06-01

### Changed

- **Group header redesign.** The grouped field name (e.g. "Fiscal Year") now
  shows as a small uppercase label *above* the value at every level (previously
  only subgroups showed it, inline). The group value is wrapped in a shadcn-style
  rounded pill, and the record count is pushed to the right edge of the first
  column (`ml-auto`). Group rows now draw column borders (`border-r`/`border-b`)
  so the column grid stays visible when grouped, and the level-tinted background
  contrast was increased (tints 32/21/13, was 18/11/6).
- **Data rows align with the group arrow.** A grouped data row's first column now
  indents to `12 + (depth-1)*14` — lining up with the deepest group header's
  disclosure chevron (previously offset a further 24px to the label).

## [0.1.4] - 2026-05-31

### Changed

- Grouped **data rows** now indent their first column to nest under the group
  header instead of sitting flush-left. The leading cell's `paddingLeft` aligns
  with the deepest group header's label (`12 + (depth-1)×14 + 24` px, where 24 is
  the chevron + gap that precede the label). Applied only while grouping is
  active; ungrouped tables and non-leading columns are unchanged.

## [0.1.3] - 2026-05-31

### Added

- Multi-field **Sort** toolbar control (button + popover panel) with parity to
  Group by: add/remove/reorder up to 3 sort levels, per-field direction with
  type-aware labels, "Clear all". Persisted to localStorage.
- `useSort` is now multi-field (`sortLevels` / `setSortLevels`) while remaining
  backward-compatible (`sortField` / `sortDirection` / `setSort` still reflect
  and drive the primary level, so header-click sorting is unchanged). Legacy
  single-object persisted values are migrated to one level.
- `sortRecordsMulti(records, levels)` + `SortLevel` exported from the package.

## [0.1.2] - 2026-05-31

### Changed

- Group-header rows are now visually distinct: level-aware shaded background
  (strongest at the top level, lighter when nested), a left accent bar, more
  vertical padding, and reduced per-level indentation (12 + level×14 px, was
  16 + level×24). All inline styles driven by the theme's `--dt-*` variables.

## [0.1.1] - 2026-05-31

### Added

- Auto-detecting ordinal group ordering. Recognized vocabularies (High/Medium/Low,
  sales-funnel stages, In-Progress/Complete, sizes, weekdays, months, …) now sort
  group-by headers by their canonical sequence instead of alphabetically. Extend the
  registry in `src/lib/ordinal-vocabularies.ts` — it is meant to grow over time.
  Unrecognized value sets fall back to the previous numeric-aware alphabetical sort,
  and `(Empty)` still sorts last. No API change.

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
