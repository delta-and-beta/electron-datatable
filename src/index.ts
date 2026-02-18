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
} from './types'

// Pure logic (framework-agnostic)
export { groupRecords, getGroupKey, getDatePeriodKey, sortGroups } from './lib/group-by'

// React hooks (individually importable)
export { useGroupBy } from './hooks/useGroupBy'
export { useColumns } from './hooks/useColumns'
export { useSearch } from './hooks/useSearch'
export { useSort } from './hooks/useSort'

// Context
export { DataTableProvider, useDataTable } from './context'

// Components
export { DataTable } from './components/DataTable'
