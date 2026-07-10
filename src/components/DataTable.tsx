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
import { Footer, type FooterKpi } from './Footer'
import { Search } from './toolbar/Search'
import { GroupByToolbarButton } from './toolbar/GroupByToolbarButton'
import { GroupByConfigPanel } from './toolbar/GroupByConfigPanel'
import { ColumnToggle } from './toolbar/ColumnToggle'
import { DateFilter } from './toolbar/DateFilter'
import { FilterToolbarButton } from './toolbar/FilterToolbarButton'
import { FilterConfigPanel } from './toolbar/FilterConfigPanel'
import { SortControl } from './toolbar/SortControl'
import { GroupHeader } from './headers/GroupHeader'
import { DataTableErrorBoundary } from './ErrorBoundary'
import { devWarn } from '../lib/dev-warn'
import { cn } from '../lib/utils'
import { ACTIONS_COLUMN_ID, makeActionsColumn } from '../actions'
import { asRecord } from '../lib/as-record'

function DataTableRoot<T extends object = RowData>({
  data,
  columns,
  actions,
  rowKey,
  storageKey = 'dt',
  preset = 'none',
  attachmentAdapter,
  defaultSort,
  defaultGroupBy,
  onRowClick,
  onRowContextMenu,
  toolbarExtra,
  footerKpis,
  className,
  children,
}: DataTableProps<T>) {
  const tableColumns = useMemo(() => {
    const columnsWithTagOptions = columns.map((column) => {
      if (column.type !== 'tags' || column.options !== undefined) return column

      const values = new Set<string>()
      for (const row of data) {
        const tags = asRecord(row)[column.id]
        if (!Array.isArray(tags)) continue
        for (const tag of tags) {
          if (typeof tag === 'string') values.add(tag)
        }
      }

      return {
        ...column,
        options: [...values].sort((a, b) => a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base',
        })),
      }
    })

    return actions && actions.length > 0
      ? [...columnsWithTagOptions, makeActionsColumn(actions)]
      : columnsWithTagOptions
  }, [actions, columns, data])

  const configurableColumns = useMemo(
    () => tableColumns.filter((column) => column.id !== ACTIONS_COLUMN_ID),
    [tableColumns],
  )

  // Filter (condition-based)
  const filter = useFilter({ data, columns: tableColumns, storageKey })

  // Search (free-text, on filtered data)
  const search = useSearch({ data: filter.filteredData, columns: tableColumns })

  // Sort
  const sort = useSort({
    data: search.filteredData,
    defaultField: defaultSort?.field,
    defaultDirection: defaultSort?.direction,
    storageKey,
  })

  // Columns
  const columnState = useColumns({ columns: configurableColumns, storageKey })

  // Group-by
  const sumFields = tableColumns
    .filter((c) => c.sumInGroup !== false && (c.type === 'number' || c.type === 'currency'))
    .map((c) => c.id)

  const groupBy = useGroupBy({
    data: sort.sortedData,
    columns: tableColumns,
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
      columns: tableColumns,
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
      tableColumns,
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
    devWarn(tableColumns.length === 0, 'columns array is empty')
    devWarn(
      data.length > 0 && !(rowKey in data[0]),
      `rowKey "${rowKey}" not found on data items`,
    )
    devWarn(storageKey === '', 'storageKey is empty string, localStorage persistence disabled')
    devWarn(
      !!defaultSort?.field && !tableColumns.some((c) => c.id === defaultSort.field),
      `defaultSort field "${defaultSort?.field}" not found in columns`,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preset: full — renders complete toolbar + content + footer
  if (preset === 'full' && !children) {
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue}>
          <div className={cn('relative', className)}>
            <FullPreset<T>
              onRowClick={onRowClick}
              toolbarExtra={toolbarExtra}
              footerKpis={footerKpis}
            />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
  }

  // Preset: minimal — content + footer only, no toolbar
  if (preset === 'minimal' && !children) {
    return (
      <DataTableErrorBoundary>
        <DataTableProvider value={contextValue}>
          <div className={cn('relative', className)}>
            <Content<T> onRowClick={onRowClick} />
            <Footer kpis={footerKpis} />
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
  }

  return (
    <DataTableErrorBoundary>
      <DataTableProvider value={contextValue}>
        <div className={cn('relative', className)}>{children}</div>
      </DataTableProvider>
    </DataTableErrorBoundary>
  )
}

/** Full preset layout: toolbar + content + footer */
function FullPreset<T extends object>({
  onRowClick,
  toolbarExtra,
  footerKpis,
}: {
  onRowClick?: (row: T) => void
  toolbarExtra?: React.ReactNode
  footerKpis?: FooterKpi[]
}) {
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)

  return (
    <>
      <FullPresetToolbar
        groupMenuOpen={groupMenuOpen}
        setGroupMenuOpen={setGroupMenuOpen}
        filterMenuOpen={filterMenuOpen}
        setFilterMenuOpen={setFilterMenuOpen}
        toolbarExtra={toolbarExtra}
      />
      <div className="overflow-auto h-full">
        <Content<T> stickyHeader onRowClick={onRowClick} />
        <Footer kpis={footerKpis} />
      </div>
    </>
  )
}

function FullPresetToolbar({
  groupMenuOpen,
  setGroupMenuOpen,
  filterMenuOpen,
  setFilterMenuOpen,
  toolbarExtra,
}: {
  groupMenuOpen: boolean
  setGroupMenuOpen: (open: boolean) => void
  filterMenuOpen: boolean
  setFilterMenuOpen: (open: boolean) => void
  toolbarExtra?: React.ReactNode
}) {
  const { groupBy, filter, columns, sort } = useDataTable()
  const groupableColumns = columns.filter((c) => c.groupable !== false && c.type !== 'tags')

  return (
    <Toolbar>
      <Search className="w-80" />
      {toolbarExtra}
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
        <SortControl levels={sort.sortLevels} columns={columns} onChange={sort.setSortLevels} />
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
