// Compound component root — wires together all hooks and provides context
// Full implementation will be built incrementally

import { useMemo, useState } from 'react'
import type { RowData, DataTableProps } from '../types'
import { DataTableProvider, type DataTableContextValue } from '../context'
import { useGroupBy } from '../hooks/useGroupBy'
import { useColumns } from '../hooks/useColumns'
import { useSearch } from '../hooks/useSearch'
import { useSort } from '../hooks/useSort'

export function DataTable<T extends RowData = RowData>({
  data,
  columns,
  rowKey,
  storageKey = 'dt',
  preset = 'none',
  attachmentAdapter,
  defaultSort,
  defaultGroupBy,
  onRowClick,
  onRowContextMenu,
  className,
  children,
}: DataTableProps<T>) {
  // Search
  const search = useSearch({ data, columns })

  // Sort
  const sort = useSort({
    data: search.filteredData,
    defaultField: defaultSort?.field,
    defaultDirection: defaultSort?.direction,
    storageKey,
  })

  // Columns
  const columnState = useColumns({ columns, storageKey })

  // Group-by
  const sumFields = columns
    .filter((c) => c.sumInGroup !== false && (c.type === 'number' || c.type === 'currency'))
    .map((c) => c.id)

  const groupBy = useGroupBy({
    data: sort.sortedData,
    columns,
    sumFields,
    storageKey,
  })

  // Date filter
  const [dateFilter, setDateFilter] = useState<{
    field: string
    start?: Date
    end?: Date
  } | null>(null)

  // Attachment counts (stub — will be populated by Content component)
  const [attachmentCounts] = useState<Record<string, number>>({})

  // Build context value
  const contextValue = useMemo<DataTableContextValue<T>>(
    () => ({
      data,
      filteredData: search.filteredData,
      sortedData: sort.sortedData,
      groupedData: groupBy.groupedData,
      searchQuery: search.query,
      setSearchQuery: search.setQuery,
      sort,
      columns,
      columnState,
      groupBy,
      dateFilter,
      setDateFilter,
      attachmentAdapter: attachmentAdapter ?? null,
      attachmentCounts,
      rowKey: rowKey as string,
      storageKey,
    }),
    [
      data,
      search.filteredData,
      sort.sortedData,
      groupBy.groupedData,
      search.query,
      search.setQuery,
      sort,
      columns,
      columnState,
      groupBy,
      dateFilter,
      attachmentAdapter,
      attachmentCounts,
      rowKey,
      storageKey,
    ],
  )

  // Preset rendering
  if (preset === 'full' && !children) {
    return (
      <DataTableProvider value={contextValue as DataTableContextValue}>
        <div className={className}>
          {/* TODO: Full preset layout */}
          <p>DataTable full preset — implementation pending</p>
        </div>
      </DataTableProvider>
    )
  }

  return (
    <DataTableProvider value={contextValue as DataTableContextValue}>
      <div className={className}>{children}</div>
    </DataTableProvider>
  )
}
