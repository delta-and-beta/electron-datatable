import { createContext, useContext } from 'react'
import type { RowData, ColumnDef, GroupedSection, AttachmentAdapter } from './types'
import type { useGroupBy } from './hooks/useGroupBy'
import type { useColumns } from './hooks/useColumns'
import type { useSort } from './hooks/useSort'
import type { useFilter } from './hooks/useFilter'

export interface DataTableContextValue<T extends RowData = RowData> {
  // Data pipeline
  data: T[]
  filteredData: T[]
  sortedData: T[]
  groupedData: GroupedSection[]

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Sort
  sort: ReturnType<typeof useSort<T>>

  // Columns
  columns: ColumnDef<T>[]
  filterColumns: ColumnDef<T>[]
  columnState: ReturnType<typeof useColumns<T>>

  // Group-by
  groupBy: ReturnType<typeof useGroupBy<T>>

  // Condition filter
  filter: ReturnType<typeof useFilter<T>>

  // Date filter
  dateFilter: { field: string; start?: Date; end?: Date } | null
  setDateFilter: (filter: { field: string; start?: Date; end?: Date } | null) => void

  // Attachments
  attachmentAdapter: AttachmentAdapter | null
  attachmentCounts: Record<string, number>
  refreshAttachmentCounts: () => void
  onAttachmentClick: ((rowId: string, event: React.MouseEvent) => void) | null

  // Config
  rowKey: string
  storageKey: string
}

const DataTableContext = createContext<DataTableContextValue | null>(null)

export const DataTableProvider = DataTableContext.Provider

export function useDataTable<T extends RowData = RowData>(): DataTableContextValue<T> {
  const ctx = useContext(DataTableContext)
  if (!ctx) {
    throw new Error('useDataTable must be used within a <DataTable> component')
  }
  return ctx as DataTableContextValue<T>
}
