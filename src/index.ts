// Core types
export type {
  RowData,
  ColumnDef,
  DatePeriod,
  GroupLevel,
  GroupConfig,
  GroupedSection,
  AttachmentAdapter,
  Attachment,
  DataTableProps,
  TextOperator,
  NumberOperator,
  DateOperator,
  FilterOperator,
  FilterCondition,
  FilterGroup,
  FilterConfig,
} from './types'

// Pure logic (framework-agnostic)
export { groupRecords, getGroupKey, getDatePeriodKey, sortGroups } from './lib/group-by'
export { filterRecords, getOperatorsForColumnType, createEmptyCondition, createEmptyGroup, getFilterDepth, countConditions } from './lib/filter'
export { formatAggregateValue } from './lib/format-aggregate'

// React hooks (individually importable)
export { useGroupBy } from './hooks/useGroupBy'
export { useColumns } from './hooks/useColumns'
export { useSearch } from './hooks/useSearch'
export { useSort } from './hooks/useSort'
export { useFilter } from './hooks/useFilter'

// Context
export { DataTableProvider, useDataTable } from './context'

// Compound component (includes sub-components: DataTable.Toolbar, DataTable.Content, etc.)
export { DataTable } from './components/DataTable'

// Individual components (for custom composition)
export { Content } from './components/Content'
export { Toolbar } from './components/Toolbar'
export { Footer } from './components/Footer'
export { GroupByToolbarButton } from './components/toolbar/GroupByToolbarButton'
export { GroupByConfigPanel } from './components/toolbar/GroupByConfigPanel'
export { Search } from './components/toolbar/Search'
export { ColumnToggle } from './components/toolbar/ColumnToggle'
export { DateFilter } from './components/toolbar/DateFilter'
export { FilterToolbarButton } from './components/toolbar/FilterToolbarButton'
export { FilterConfigPanel } from './components/toolbar/FilterConfigPanel'
export { FilterConditionRow } from './components/toolbar/FilterConditionRow'
export { GroupHeader } from './components/headers/GroupHeader'

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
