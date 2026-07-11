import { createContext, useContext } from 'react'
import type { ProviderProps, ReactNode } from 'react'
import type { RowData, ColumnDef, GroupedSection, AttachmentAdapter, KanbanConfig } from './types'
import type { useGroupBy } from './hooks/useGroupBy'
import type { useColumns } from './hooks/useColumns'
import type { useSort } from './hooks/useSort'
import type { useFilter } from './hooks/useFilter'

export interface DataTableContextValue<T extends object = RowData> {
  // Data pipeline
  data: T[]
  filteredData: T[]
  sortedData: T[]
  groupedData: GroupedSection<T>[]

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Sort
  sort: ReturnType<typeof useSort<T>>

  // Columns
  columns: ColumnDef<T>[]
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

  // Config
  rowKey: string
  storageKey: string
  kanban?: KanbanConfig<T>
  onRowClick?: (row: T) => void
}

const DataTableContext = createContext<DataTableContextValue | null>(null)

type GenericDataTableProvider = <T extends object>(
  props: ProviderProps<DataTableContextValue<T>>,
) => ReactNode

export const DataTableProvider = DataTableContext.Provider as unknown as GenericDataTableProvider

export function useDataTable<T extends object = RowData>(): DataTableContextValue<T> {
  const ctx = useContext(DataTableContext)
  if (!ctx) {
    throw new Error('useDataTable must be used within a <DataTable> component')
  }
  return ctx as unknown as DataTableContextValue<T>
}
