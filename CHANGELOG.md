# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.9] - 2026-07-07

### Fixed

- **Column widths are now single-sourced.** A `<colgroup>` (with `table-layout:
  fixed`) drives every row layer — header, data rows, and group headers — so a
  drag-resized width actually applies, including shrinking below a column's
  defined `width`. Previously only the `<th>` received the resized width and
  auto layout let the widest cell win.
- **Grouped rows can no longer shift left of the grid.** First-column indent is
  added on top of the 16px cell baseline (`16 + 24 + (levels − 1) × 14`), so
  toggling group-by never moves cell content left of its column header.
- **Collapse paths are escaped.** Group values containing `/` (e.g. `"N/A"`)
  no longer collide with nested group paths. Previously-persisted collapse
  state for such values re-opens once.
- **Sticky group headers now bind to the real scroller.** Detection uses a
  window capture-phase scroll listener and `overflow-y`-based scrollport
  resolution, and the sticky `top` is owned solely by the positioning logic so
  re-renders can't clobber the push-up offset. Positions also refresh after
  collapse/expand, not just on scroll.
- **Resize drag lifecycle.** Pointer events (mouse/touch/pen), and unmounting
  mid-drag cleans up document listeners and body cursor styles.

### Changed

- **Stacked sticky group headers.** Nested group headers now stack below their
  ancestors while scrolling (breadcrumb-style context); a stuck header is only
  pushed out by the next header at the same or a shallower level.
- **Group label band.** The group header's label cell spans the leading run of
  non-aggregatable columns; the record count sits beside the value pill instead
  of being squeezed against the first column's right edge.
- **Containment rail.** The group accent now runs down the first cell of every
  row in the group (and starts at the true left edge when the attachment
  column is present), not just the header row.
- **Accessibility.** The group row keeps native table semantics; the disclosure
  is a real `<button>` (in the first cell) with `aria-expanded` and the
  aggregate sums included in its accessible name.

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
