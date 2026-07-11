// Core types
export type {
  RowData,
  RowAction,
  ColumnDef,
  DatePeriod,
  GroupLevel,
  GroupConfig,
  GroupedSection,
  KanbanConfig,
  AttachmentAdapter,
  Attachment,
  DataTableProps,
  TextOperator,
  NumberOperator,
  DateOperator,
  TagsOperator,
  FilterOperator,
  FilterCondition,
  FilterGroup,
  FilterConfig,
  DataTableView,
  DataTableRowHeight,
} from './types'

// Config helpers
export { defineTable, defineColumns } from './defineTable'
export { makeActionsColumn } from './actions'
export {
  applyDataTableTheme,
  setDataTableThemeMode,
  getDataTableThemeMode,
} from './theme'
export type {
  DtThemeToken,
  DataTableThemeTokens,
  DataTableThemeMode,
} from './theme'

// Pure logic (framework-agnostic)
export { groupRecords, getGroupKey, getDatePeriodKey, sortGroups } from './lib/group-by'
export { filterRecords, getOperatorsForColumnType, createEmptyCondition, createEmptyGroup, getFilterDepth, countConditions } from './lib/filter'
export { formatAggregateValue } from './lib/format-aggregate'
export { formatCurrency, formatDate, formatNumber } from './lib/format'
export { sortRecords, sortRecordsMulti } from './lib/sort'
export type { SortLevel } from './lib/sort'

// React hooks (individually importable)
export { useGroupBy } from './hooks/useGroupBy'
export { useColumns } from './hooks/useColumns'
export { useSearch } from './hooks/useSearch'
export { useSort } from './hooks/useSort'
export { useFilter } from './hooks/useFilter'
export { useViews } from './hooks/useViews'

// Context
export { DataTableProvider, useDataTable } from './context'

// Compound component (includes sub-components: DataTable.Toolbar, DataTable.Content, etc.)
export { DataTable } from './components/DataTable'

// Individual components (for custom composition)
export { Content } from './components/Content'
export { KanbanBoard } from './components/KanbanBoard'
export { Toolbar } from './components/Toolbar'
export { Footer } from './components/Footer'
export type { FooterKpi } from './components/Footer'
export { Popover } from './components/Popover'
export { ViewsMenu } from './components/ViewsMenu'
export { GroupByToolbarButton } from './components/toolbar/GroupByToolbarButton'
export { GroupByConfigPanel } from './components/toolbar/GroupByConfigPanel'
export { SortToolbarButton } from './components/toolbar/SortToolbarButton'
export { SortConfigPanel } from './components/toolbar/SortConfigPanel'
export { SortControl } from './components/toolbar/SortControl'
export { Search } from './components/toolbar/Search'
export { ColumnToggle } from './components/toolbar/ColumnToggle'
export { DateFilter } from './components/toolbar/DateFilter'
export { FilterToolbarButton } from './components/toolbar/FilterToolbarButton'
export { FilterConfigPanel } from './components/toolbar/FilterConfigPanel'
export { FilterConditionRow } from './components/toolbar/FilterConditionRow'
export { GroupHeader } from './components/headers/GroupHeader'
export { StatusBadge } from './components/StatusBadge'
export type { BadgeVariant } from './components/StatusBadge'

// Table primitives
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './components/table'
