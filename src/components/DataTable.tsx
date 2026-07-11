// Compound component root — wires together all hooks and provides context

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import type { RowData, DataTableProps } from '../types'
import { DataTableProvider, useDataTable, type DataTableContextValue } from '../context'
import { useGroupBy } from '../hooks/useGroupBy'
import { useColumns } from '../hooks/useColumns'
import { useSearch } from '../hooks/useSearch'
import { useSort } from '../hooks/useSort'
import { useFilter } from '../hooks/useFilter'
import { useViews } from '../hooks/useViews'
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
import { Popover } from './Popover'
import { devWarn } from '../lib/dev-warn'
import { cn } from '../lib/utils'
import { ACTIONS_COLUMN_ID, makeActionsColumn } from '../actions'
import { asRecord } from '../lib/as-record'
import { KanbanBoard } from './KanbanBoard'
import { ViewsMenu } from './ViewsMenu'
import { useBatchSelection } from '../hooks/useBatchSelection'
import { BulkActionBar } from './BulkActionBar'

function DataTableRoot<T extends object = RowData>({
  data,
  columns,
  actions,
  bulkActions,
  rowKey,
  storageKey = 'dt',
  frozenColumns = 0,
  preset = 'none',
  attachmentAdapter,
  defaultSort,
  defaultGroupBy,
  kanban,
  viewMode: controlledViewMode,
  onViewModeChange,
  onRowClick,
  onRowContextMenu,
  onCellEdit,
  onCellEditError,
  toolbarExtra,
  footerKpis,
  className,
  children,
}: DataTableProps<T>) {
  const [uncontrolledViewMode, setUncontrolledViewMode] = useState<'table' | 'kanban'>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-viewmode`)
      return saved === 'kanban' || saved === 'table' ? saved : 'table'
    } catch {
      return 'table'
    }
  })
  const viewMode = kanban ? controlledViewMode ?? uncontrolledViewMode : 'table'
  const viewModeRef = useRef(viewMode)
  const controlledViewModeRef = useRef(controlledViewMode)
  const kanbanRef = useRef(kanban)
  const onViewModeChangeRef = useRef(onViewModeChange)
  const storageKeyRef = useRef(storageKey)
  viewModeRef.current = viewMode
  controlledViewModeRef.current = controlledViewMode
  kanbanRef.current = kanban
  onViewModeChangeRef.current = onViewModeChange
  storageKeyRef.current = storageKey

  useEffect(() => {
    if (!kanban || controlledViewMode !== undefined) return
    try {
      localStorage.setItem(`${storageKey}-viewmode`, uncontrolledViewMode)
    } catch {
      // ignore quota errors
    }
  }, [controlledViewMode, kanban, storageKey, uncontrolledViewMode])

  const getViewModeSnapshot = useCallback(() => viewModeRef.current, [])
  const setViewMode = useCallback((requested: 'table' | 'kanban') => {
    const next = requested === 'kanban' && !kanbanRef.current ? 'table' : requested
    if (controlledViewModeRef.current === undefined) setUncontrolledViewMode(next)
    try {
      localStorage.setItem(`${storageKeyRef.current}-viewmode`, next)
    } catch {
      // ignore quota errors
    }
    viewModeRef.current = next
    onViewModeChangeRef.current?.(next)
  }, [])
  const viewModeFacet = useMemo(() => ({
    getSnapshot: getViewModeSnapshot,
    restore: setViewMode,
  }), [getViewModeSnapshot, setViewMode])

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
  const columnState = useColumns({ columns: configurableColumns, storageKey, frozenColumns })

  // Group-by
  const sumFields = tableColumns
    .filter((c) => c.sumInGroup !== false && (c.type === 'number' || c.type === 'currency'))
    .map((c) => c.id)

  const groupBy = useGroupBy({
    data: sort.sortedData,
    columns: tableColumns,
    sumFields,
    storageKey,
    defaultLevels: defaultGroupBy && defaultGroupBy.length > 0
      ? defaultGroupBy
      : kanban?.laneField
        ? [{ field: kanban.laneField, sort: 'asc' }]
        : defaultGroupBy,
    seedLevelWhenEmpty: kanban?.laneField
      ? { field: kanban.laneField, sort: 'asc' }
      : undefined,
  })

  const selection = useBatchSelection({
    enabled: bulkActions !== undefined,
    rows: sort.sortedData,
    rowKey: rowKey as string,
  })
  const clearSelection = selection.clear

  useEffect(() => {
    clearSelection()
  }, [clearSelection, filter.enabled, filter.root, search.query, viewMode])

  const views = useViews({
    storageKey,
    columns: columnState,
    sort,
    filter,
    groupBy,
    viewMode: viewModeFacet,
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
      selection,
      searchQuery: search.query,
      setSearchQuery: search.setQuery,
      sort,
      columns: tableColumns,
      columnState,
      groupBy,
      filter,
      views,
      dateFilter,
      setDateFilter,
      attachmentAdapter: attachmentAdapter ?? null,
      attachmentCounts,
      refreshAttachmentCounts,
      rowKey: rowKey as string,
      storageKey,
      kanban,
      onRowClick,
      onCellEdit,
      onCellEditError,
    }),
    [
      data,
      search.filteredData,
      selection,
      search.query,
      search.setQuery,
      sort,
      tableColumns,
      columnState,
      groupBy,
      filter,
      views,
      dateFilter,
      attachmentAdapter,
      attachmentCounts,
      refreshAttachmentCounts,
      rowKey,
      storageKey,
      kanban,
      onRowClick,
      onCellEdit,
      onCellEditError,
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
    devWarn(
      columns.some((column) => column.editable && column.render !== undefined),
      'editable is ignored for custom-rendered columns',
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
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              hasKanban={kanban !== undefined}
            />
            {bulkActions && viewMode === 'table' && <BulkActionBar<T> actions={bulkActions} />}
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
            {bulkActions && viewMode === 'table' && <BulkActionBar<T> actions={bulkActions} />}
          </div>
        </DataTableProvider>
      </DataTableErrorBoundary>
    )
  }

  return (
    <DataTableErrorBoundary>
      <DataTableProvider value={contextValue}>
        <div className={cn('relative', className)}>
          {children}
          {bulkActions && viewMode === 'table' && <BulkActionBar<T> actions={bulkActions} />}
        </div>
      </DataTableProvider>
    </DataTableErrorBoundary>
  )
}

/** Full preset layout: toolbar + content + footer */
function FullPreset<T extends object>({
  onRowClick,
  toolbarExtra,
  footerKpis,
  viewMode,
  onViewModeChange,
  hasKanban,
}: {
  onRowClick?: (row: T) => void
  toolbarExtra?: React.ReactNode
  footerKpis?: FooterKpi[]
  viewMode: 'table' | 'kanban'
  onViewModeChange: (viewMode: 'table' | 'kanban') => void
  hasKanban: boolean
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
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        hasKanban={hasKanban}
      />
      <div className="h-full overflow-auto">
        {viewMode === 'kanban' ? <KanbanBoard<T> /> : <Content<T> stickyHeader onRowClick={onRowClick} />}
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
  viewMode,
  onViewModeChange,
  hasKanban,
}: {
  groupMenuOpen: boolean
  setGroupMenuOpen: (open: boolean) => void
  filterMenuOpen: boolean
  setFilterMenuOpen: (open: boolean) => void
  toolbarExtra?: React.ReactNode
  viewMode: 'table' | 'kanban'
  onViewModeChange: (viewMode: 'table' | 'kanban') => void
  hasKanban: boolean
}) {
  const { groupBy, filter, columns, sort } = useDataTable()
  const groupableColumns = columns.filter((c) => c.groupable !== false && c.type !== 'tags')

  return (
    <Toolbar>
      <ViewsMenu />
      <Search className="w-80" />
      {toolbarExtra}
      <div className="flex items-center gap-3">
        {hasKanban ? (
          <div className="inline-flex items-center rounded-md border border-dt-border bg-dt-bg p-0.5">
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
              onClick={() => onViewModeChange('table')}
              className={cn(
                'rounded p-1.5 text-dt-muted transition-colors hover:text-dt-text',
                viewMode === 'table' && 'bg-dt-bg-secondary text-dt-text',
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Board view"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => onViewModeChange('kanban')}
              className={cn(
                'rounded p-1.5 text-dt-muted transition-colors hover:text-dt-text',
                viewMode === 'kanban' && 'bg-dt-bg-secondary text-dt-text',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <Popover
          open={filterMenuOpen}
          onOpenChange={setFilterMenuOpen}
          trigger={<FilterToolbarButton
            activeCount={filter.activeCount}
            enabled={filter.enabled}
            isOpen={filterMenuOpen}
            onToggleEnabled={filter.setEnabled}
          />}
          aria-label="Filter configuration"
          contentClassName="w-[520px]"
        >
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
        </Popover>
        <Popover
          open={groupMenuOpen}
          onOpenChange={setGroupMenuOpen}
          trigger={<GroupByToolbarButton
            activeCount={groupBy.levels.length}
            isOpen={groupMenuOpen}
          />}
          aria-label="Group by configuration"
          contentClassName="w-[520px]"
        >
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
        </Popover>
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
  KanbanBoard,
  ViewsMenu,
})
