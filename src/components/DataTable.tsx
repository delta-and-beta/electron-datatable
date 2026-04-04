// Compound component root — wires together all hooks and provides context

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RowData, DataTableProps } from '../types'
import { DataTableProvider, useDataTable, type DataTableContextValue } from '../context'
import { useGroupBy } from '../hooks/useGroupBy'
import { useColumns } from '../hooks/useColumns'
import { useSearch } from '../hooks/useSearch'
import { useSort } from '../hooks/useSort'
import { useFilter } from '../hooks/useFilter'
import { Toolbar } from './Toolbar'
import { Content } from './Content'
import { Footer } from './Footer'
import { Search } from './toolbar/Search'
import { GroupByToolbarButton } from './toolbar/GroupByToolbarButton'
import { GroupByConfigPanel } from './toolbar/GroupByConfigPanel'
import { ColumnToggle } from './toolbar/ColumnToggle'
import { DateFilter } from './toolbar/DateFilter'
import { FilterToolbarButton } from './toolbar/FilterToolbarButton'
import { FilterConfigPanel } from './toolbar/FilterConfigPanel'
import { GroupHeader } from './headers/GroupHeader'
import { DataTableErrorBoundary } from './ErrorBoundary'
import { devWarn } from '../lib/dev-warn'
import { cn } from '../lib/utils'

function DataTableRoot<T extends RowData = RowData>({
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
  // Filter (condition-based)
  const filter = useFilter({ data, columns, storageKey })

  // Search (free-text, on filtered data)
  const search = useSearch({ data: filter.filteredData, columns })

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
    defaultLevels: defaultGroupBy,
  })

  // Date filter
  const [dateFilter, setDateFilter] = useState<{
    field: string
    start?: Date
    end?: Date
  } | null>(null)

  // Attachment counts
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})

  const refreshAttachmentCounts = useCallback(() => {
    if (!attachmentAdapter) return
    const ids = data.map((row) => String(row[rowKey]))
    if (ids.length === 0) return
    attachmentAdapter.getCounts(ids).then(setAttachmentCounts).catch(() => {})
  }, [attachmentAdapter, data, rowKey])

  // Load attachment counts on mount and when data changes
  useEffect(() => {
    refreshAttachmentCounts()
  }, [refreshAttachmentCounts])

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
      filter,
      dateFilter,
      setDateFilter,
      attachmentAdapter: attachmentAdapter ?? null,
      attachmentCounts,
      refreshAttachmentCounts,
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
      filter,
      dateFilter,
      attachmentAdapter,
      attachmentCounts,
      refreshAttachmentCounts,
      rowKey,
      storageKey,
    ],
  )

  // Dev-mode config validation
  useEffect(() => {
    devWarn(columns.length === 0, 'columns array is empty')
    devWarn(
      data.length > 0 && !(rowKey in data[0]),
      `rowKey "${rowKey}" not found on data items`,
    )
    devWarn(storageKey === '', 'storageKey is empty string, localStorage persistence disabled')
    devWarn(
      !!defaultSort?.field && !columns.some((c) => c.id === defaultSort.field),
      `defaultSort field "${defaultSort?.field}" not found in columns`,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preset: full — renders complete toolbar + content + footer
  if (preset === 'full' && !children) {
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue as DataTableContextValue}>
          <div className={cn('relative', className)}>
            <FullPreset onRowClick={onRowClick as ((row: RowData) => void) | undefined} />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
  }

  // Preset: minimal — content + footer only, no toolbar
  if (preset === 'minimal' && !children) {
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue as DataTableContextValue}>
          <div className={cn('relative', className)}>
            <Content onRowClick={onRowClick as ((row: RowData) => void) | undefined} />
            <Footer />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
  }

  return (
    <DataTableErrorBoundary>
      <DataTableProvider value={contextValue as DataTableContextValue}>
        <div className={cn('relative', className)}>{children}</div>
      </DataTableProvider>
    </DataTableErrorBoundary>
  )
}

/** Full preset layout: toolbar + content + footer */
function FullPreset({ onRowClick }: { onRowClick?: (row: RowData) => void }) {
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)

  return (
    <>
      <FullPresetToolbar
        groupMenuOpen={groupMenuOpen}
        setGroupMenuOpen={setGroupMenuOpen}
        filterMenuOpen={filterMenuOpen}
        setFilterMenuOpen={setFilterMenuOpen}
      />
      <div className="overflow-auto h-full">
        <Content stickyHeader onRowClick={onRowClick} />
        <Footer />
      </div>
    </>
  )
}

function FullPresetToolbar({
  groupMenuOpen,
  setGroupMenuOpen,
  filterMenuOpen,
  setFilterMenuOpen,
}: {
  groupMenuOpen: boolean
  setGroupMenuOpen: (open: boolean) => void
  filterMenuOpen: boolean
  setFilterMenuOpen: (open: boolean) => void
}) {
  const { groupBy, filter, columns } = useDataTable()
  const groupableColumns = columns.filter((c) => c.groupable !== false)

  return (
    <Toolbar>
      <Search className="w-80" />
      <div className="flex items-center gap-3">
        <div className="relative">
          <FilterToolbarButton
            activeCount={filter.activeCount}
            enabled={filter.enabled}
            isOpen={filterMenuOpen}
            onClick={() => setFilterMenuOpen(!filterMenuOpen)}
            onToggleEnabled={filter.setEnabled}
          />
          {filterMenuOpen && (
            <FilterConfigPanel
              root={filter.root}
              columns={columns}
              enabled={filter.enabled}
              onSetEnabled={filter.setEnabled}
              onAddCondition={filter.addCondition}
              onRemoveCondition={filter.removeCondition}
              onUpdateCondition={filter.updateCondition}
              onAddGroup={filter.addGroup}
              onRemoveGroup={filter.removeGroup}
              onUpdateConjunction={filter.updateConjunction}
              onClearAll={filter.clearAll}
              onClose={() => setFilterMenuOpen(false)}
            />
          )}
        </div>
        <div className="relative">
          <GroupByToolbarButton
            activeCount={groupBy.levels.length}
            isOpen={groupMenuOpen}
            onClick={() => setGroupMenuOpen(!groupMenuOpen)}
          />
          {groupMenuOpen && (
            <GroupByConfigPanel
              levels={groupBy.levels}
              columns={groupableColumns}
              onAddGroup={groupBy.addGroup}
              onRemoveGroup={groupBy.removeGroup}
              onUpdateGroup={groupBy.updateGroup}
              onReorderGroups={groupBy.reorderGroups}
              onCollapseAll={groupBy.collapseAll}
              onExpandAll={groupBy.expandAll}
              showEmpty={groupBy.showEmpty}
              onToggleShowEmpty={groupBy.setShowEmpty}
              onClose={() => setGroupMenuOpen(false)}
            />
          )}
        </div>
        <ColumnToggle />
      </div>
    </Toolbar>
  )
}

// Compound component with sub-components attached
export const DataTable = Object.assign(DataTableRoot, {
  Toolbar,
  Content,
  Footer,
  Search,
  GroupBy: GroupByToolbarButton,
  GroupByPanel: GroupByConfigPanel,
  ColumnToggle,
  DateFilter,
  Filter: FilterToolbarButton,
  FilterPanel: FilterConfigPanel,
  GroupHeader,
})
