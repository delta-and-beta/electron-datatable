# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
