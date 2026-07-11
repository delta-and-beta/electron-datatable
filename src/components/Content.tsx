import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Paperclip } from 'lucide-react'
import { cn } from '../lib/utils'
import { useDataTable } from '../context'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'
import { GroupHeader } from './headers'
import type { RowData, ColumnDef, GroupedSection } from '../types'
import { asRecord } from '../lib/as-record'
import { ACTIONS_COLUMN_ID } from '../actions'
import { renderColumnValue } from './render-column-value'

/** Resolve effective text alignment — currency/number default to right */
function getAlign<T extends object>(col: ColumnDef<T>): 'left' | 'center' | 'right' {
  return col.align ?? ((col.type === 'currency' || col.type === 'number') ? 'right' : 'left')
}

function pixelWidth(width: string | number | undefined, measured?: number): number {
  if (typeof width === 'number') return width
  if (typeof width === 'string' && /^\d+(?:\.\d+)?(?:px)?$/.test(width.trim())) {
    return Number.parseFloat(width)
  }
  return measured ?? 0
}

/* ---------------------------------------------------------------------------
 * Props
 * --------------------------------------------------------------------------- */

interface ContentProps<T extends object> {
  emptyMessage?: string
  stickyHeader?: boolean
  rowClassName?: (row: T) => string | undefined
  className?: string
  renderCell?: (column: ColumnDef<T>, value: unknown, row: T) => React.ReactNode
  onRowClick?: (row: T) => void
}

/* ---------------------------------------------------------------------------
 * Content
 * --------------------------------------------------------------------------- */

export function Content<T extends object = RowData>({
  emptyMessage = 'No records found',
  stickyHeader = true,
  rowClassName,
  className,
  renderCell,
  onRowClick,
}: ContentProps<T>) {
  const { sortedData, groupedData, columns, columnState, groupBy, sort, rowKey, attachmentAdapter, attachmentCounts, views } = useDataTable<T>()
  const rowHeightClass = {
    short: 'dt-row-height-short py-1.5',
    medium: 'dt-row-height-medium py-3',
    tall: 'dt-row-height-tall py-5',
  }[views.rowHeight]

  // Resolve visible columns in display order
  const visibleColumns = columnState.visibleColumns
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is ColumnDef<T> => c !== undefined)
    .concat(columns.filter((column) => column.id === ACTIONS_COLUMN_ID))

  const headerRefs = useRef(new Map<string, HTMLTableCellElement>())
  const [measuredWidths, setMeasuredWidths] = useState<Record<string, number>>({})
  const visibleColumnSignature = visibleColumns.map((column) => column.id).join('\u0000')

  useLayoutEffect(() => {
    const measure = () => {
      setMeasuredWidths((previous) => {
        let changed = false
        const next = { ...previous }
        for (const [id, header] of headerRefs.current) {
          const width = header.getBoundingClientRect().width
          if (width > 0 && previous[id] !== width) {
            next[id] = width
            changed = true
          }
        }
        return changed ? next : previous
      })
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    headerRefs.current.forEach((header) => observer.observe(header))
    return () => observer.disconnect()
  }, [visibleColumnSignature])

  const resolvedWidths = Object.fromEntries(
    visibleColumns.map((column) => [
      column.id,
      columnState.widths[column.id] ?? column.width,
    ]),
  ) as Record<string, string | number | undefined>

  const configurableVisibleColumns = visibleColumns.filter(
    (column) => column.id !== ACTIONS_COLUMN_ID,
  )
  const frozenCount = Math.min(
    columnState.frozenColumns,
    configurableVisibleColumns.length,
  )
  const frozenIds = new Set(
    configurableVisibleColumns.slice(0, frozenCount).map((column) => column.id),
  )
  const frozenOffsets: Record<string, number> = {}
  let frozenOffset = 0
  for (const column of configurableVisibleColumns.slice(0, frozenCount)) {
    frozenOffsets[column.id] = frozenOffset
    frozenOffset += pixelWidth(resolvedWidths[column.id], measuredWidths[column.id])
  }
  const lastFrozenId = configurableVisibleColumns[frozenCount - 1]?.id

  const hasAttachments = attachmentAdapter !== null
  const extraColSpan = hasAttachments ? 1 : 0
  const colSpan = Math.max(visibleColumns.length, 1) + extraColSpan
  const isGrouped = groupBy.isGrouped
  const isEmpty = sortedData.length === 0

  // When grouped, every data row is a leaf at the deepest level
  // (groupBy.levels.length). Indent its first column to line up with the deepest
  // group header's disclosure chevron — i.e. that header's own paddingLeft
  // (12 + level*14, level = depth-1) — so the row sits directly under the arrow.
  const groupRowIndent =
    groupBy.levels.length > 0 ? 12 + (groupBy.levels.length - 1) * 14 : undefined

  // Aggregate cell renderer — same pipeline as data cells but without a row
  const renderAggregateCell = renderCell
    ? (col: ColumnDef<T>, value: unknown) => renderCell(col, value, {} as T)
    : (col: ColumnDef<T>, value: unknown) => renderColumnValue(col, value)

  /* -----------------------------------------------------------------------
   * Render a single data row
   * ----------------------------------------------------------------------- */

  function renderRow(row: T, index: number) {
    const isClickable = !!onRowClick
    const record = asRecord(row)
    const key = record[rowKey] != null ? String(record[rowKey]) : `row-${index}`

    return (
      <TableRow
        key={key}
        data-row-id={record[rowKey] != null ? String(record[rowKey]) : undefined}
        className={cn(
          'dt-data-row',
          `dt-row-height-${views.rowHeight}`,
          isClickable && 'cursor-pointer',
          rowClassName?.(row),
        )}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => onRowClick(row) : undefined}
        onKeyDown={
          isClickable
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRowClick(row)
                }
              }
            : undefined
        }
      >
        {hasAttachments && (
          <TableCell key="__attachments" className={cn('text-center', rowHeightClass)} style={{ width: '50px' }}>
            {(attachmentCounts[String(record[rowKey])] ?? 0) > 0 ? (
              <span className="flex items-center justify-center gap-0.5 text-dt-primary">
                <Paperclip className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{attachmentCounts[String(record[rowKey])]}</span>
              </span>
            ) : (
              <Paperclip className="w-3.5 h-3.5 mx-auto text-dt-muted opacity-20" />
            )}
          </TableCell>
        )}
        {visibleColumns.map((col) => {
          const value = record[col.id]
          const align = getAlign(col)
          const isFirstCol = col.id === visibleColumns[0]?.id
          const isFrozen = frozenIds.has(col.id)
          const isFrozenEdge = col.id === lastFrozenId
          return (
            <TableCell
              key={col.id}
              className={cn(
                'relative z-0',
                rowHeightClass,
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                (col.type === 'currency' || col.type === 'number') && 'tabular-nums',
                isFrozen && 'dt-frozen-cell sticky z-10',
                isFrozenEdge && 'dt-frozen-edge',
              )}
              style={{
                ...(resolvedWidths[col.id]
                  ? { width: resolvedWidths[col.id] }
                  : {}),
                ...(isFrozen
                  ? { position: 'sticky', left: frozenOffsets[col.id] }
                  : {}),
                ...(isFirstCol && groupRowIndent !== undefined
                  ? { paddingLeft: groupRowIndent }
                  : {}),
              }}
            >
              {renderCell
                ? renderCell(col, value, row)
                : renderColumnValue(col, value, row, true)}
            </TableCell>
          )
        })}
      </TableRow>
    )
  }

  /* -----------------------------------------------------------------------
   * Recursive subgroup rendering
   * ----------------------------------------------------------------------- */

  function renderSubgroup(
    section: GroupedSection<T>,
    parentPath: string,
  ): React.ReactNode {
    const path = parentPath ? `${parentPath}/${section.key}` : section.key
    const collapsed = groupBy.isCollapsed(path)

    return (
      <Fragment key={path}>
        <GroupHeader<T>
          groupKey={section.key}
          fieldLabel={section.fieldLabel}
          level={section.level}
          count={section.count}
          columns={visibleColumns}
          sums={section.sums}
          isCollapsed={collapsed}
          onToggle={() => groupBy.toggleCollapse(path)}
          renderCell={renderAggregateCell}
          extraColSpan={extraColSpan}
          resolvedWidths={resolvedWidths}
          frozenOffsets={frozenOffsets}
          lastFrozenId={lastFrozenId}
        />

        {!collapsed && (
          <>
            {section.subgroups.length > 0
              ? section.subgroups.map((sub) => renderSubgroup(sub, path))
              : section.records.map((row, i) => renderRow(row, i))}
          </>
        )}
      </Fragment>
    )
  }

  /* -----------------------------------------------------------------------
   * Sort indicator
   * ----------------------------------------------------------------------- */

  function renderSortIcon(columnId: string) {
    if (sort.sortField !== columnId) {
      return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-dt-muted/50" />
    }
    return sort.sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3.5 w-3.5 text-dt-primary" />
    ) : (
      <ArrowDown className="ml-1 inline h-3.5 w-3.5 text-dt-primary" />
    )
  }

  /* -----------------------------------------------------------------------
   * Column resize — drag the right edge of a header cell. The header cell's
   * width drives the whole column; the chosen width is persisted via useColumns.
   * ----------------------------------------------------------------------- */

  function startResize(e: React.MouseEvent, columnId: string) {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    const startWidth = th ? th.getBoundingClientRect().width : 150
    const onMove = (ev: MouseEvent) => {
      columnState.setColumnWidth(columnId, Math.max(60, Math.round(startWidth + (ev.clientX - startX))))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /* -----------------------------------------------------------------------
   * Render
   * ----------------------------------------------------------------------- */

  return (
    <Table className={className}>
      <TableHeader className={cn(stickyHeader && 'sticky top-0 z-20 bg-dt-bg')}>
        <TableRow>
          {hasAttachments && (
            <TableHead scope="col" className="text-center" style={{ width: '50px' }}>
              <Paperclip className="w-3.5 h-3.5 mx-auto text-dt-muted" />
            </TableHead>
          )}
          {visibleColumns.map((col) => {
            const align = getAlign(col)
            const isSortable = col.sortable !== false
            const isFrozen = frozenIds.has(col.id)
            const isFrozenEdge = col.id === lastFrozenId

            const ariaSortValue = !isSortable
              ? undefined
              : sort.sortField !== col.id
                ? 'none' as const
                : sort.sortDirection === 'asc'
                  ? 'ascending' as const
                  : 'descending' as const

            return (
              <TableHead
                key={col.id}
                ref={(element) => {
                  if (element) headerRefs.current.set(col.id, element)
                  else headerRefs.current.delete(col.id)
                }}
                scope="col"
                aria-sort={ariaSortValue}
                className={cn(
                  'relative',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  isFrozen && 'dt-frozen-header sticky z-30',
                  isFrozenEdge && 'dt-frozen-edge',
                )}
                style={{
                  width: resolvedWidths[col.id],
                  ...(isFrozen
                    ? { position: 'sticky', left: frozenOffsets[col.id] }
                    : {}),
                }}
              >
                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => sort.setSort(col.id)}
                    className="inline-flex items-center gap-0.5 cursor-pointer select-none bg-transparent border-none p-0 font-medium text-dt-muted hover:text-dt-text"
                  >
                    {col.headerRender ? col.headerRender() : col.label}
                    {renderSortIcon(col.id)}
                  </button>
                ) : (
                  col.headerRender ? col.headerRender() : col.label
                )}
                {col.id !== ACTIONS_COLUMN_ID && (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(e) => startResize(e, col.id)}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to resize"
                    className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-dt-primary/50"
                  />
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>

      {isEmpty ? (
        <TableBody>
          <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center text-dt-muted">
              {emptyMessage}
            </TableCell>
          </TableRow>
        </TableBody>
      ) : isGrouped ? (
        groupedData.map((section) => {
          const path = section.key
          const collapsed = groupBy.isCollapsed(path)

          return (
            <TableBody key={path}>
              <GroupHeader<T>
                groupKey={section.key}
                fieldLabel={section.fieldLabel}
                level={section.level}
                count={section.count}
                columns={visibleColumns}
                sums={section.sums}
                isCollapsed={collapsed}
                onToggle={() => groupBy.toggleCollapse(path)}
                extraColSpan={extraColSpan}
                resolvedWidths={resolvedWidths}
                frozenOffsets={frozenOffsets}
                lastFrozenId={lastFrozenId}
              />

              {!collapsed && (
                <>
                  {section.subgroups.length > 0
                    ? section.subgroups.map((sub) => renderSubgroup(sub, path))
                    : section.records.map((row, i) => renderRow(row, i))}
                </>
              )}
            </TableBody>
          )
        })
      ) : (
        <TableBody>
          {sortedData.map((row, i) => renderRow(row, i))}
        </TableBody>
      )}
    </Table>
  )
}

Content.displayName = 'Content'
