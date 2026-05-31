# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
