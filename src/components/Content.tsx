import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Paperclip } from 'lucide-react'
import { cn } from '../lib/utils'
import { formatDate, formatNumber, formatCurrency } from '../lib/format'
import { joinGroupPath } from '../lib/group-path'
import { useDataTable } from '../context'
import { useMatchingContext } from '../matching-context'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'
import { GroupHeader } from './headers'
import { groupRail } from './headers/group-style'
import type { RowData, ColumnDef, GroupedSection } from '../types'

/** Resolve effective text alignment — currency/number default to right */
function getAlign(col: ColumnDef): 'left' | 'center' | 'right' {
  return col.align ?? ((col.type === 'currency' || col.type === 'number') ? 'right' : 'left')
}

/* ---------------------------------------------------------------------------
 * Props
 * --------------------------------------------------------------------------- */

interface ContentProps {
  emptyMessage?: string
  stickyHeader?: boolean
  rowClassName?: (row: RowData) => string | undefined
  className?: string
  renderCell?: (column: ColumnDef, value: unknown, row: RowData) => React.ReactNode
  onRowClick?: (row: RowData) => void
}

/* ---------------------------------------------------------------------------
 * Default cell rendering
 * --------------------------------------------------------------------------- */

function defaultRenderCell(column: ColumnDef, value: unknown): React.ReactNode {
  if (column.render) {
    return column.render(value, {} as RowData)
  }

  if (column.format) {
    return column.format(value)
  }

  if (value == null) return '-'

  switch (column.type) {
    case 'date':
      return formatDate(value as string | Date)
    case 'number':
      return formatNumber(value as number)
    case 'currency':
      return formatCurrency(value as number, column.currency)
    case 'text':
    default:
      return String(value)
  }
}

/* ---------------------------------------------------------------------------
 * Content
 * --------------------------------------------------------------------------- */

export function Content({
  emptyMessage = 'No records found',
  stickyHeader = true,
  rowClassName,
  className,
  renderCell,
  onRowClick,
}: ContentProps) {
  const { sortedData, groupedData, columns, columnState, groupBy, sort, rowKey, attachmentAdapter, attachmentCounts, refreshAttachmentCounts, onAttachmentClick } = useDataTable()
  const matching = useMatchingContext()

  // Resolve visible columns in display order
  const visibleColumns = columnState.visibleColumns
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is ColumnDef => c !== undefined)

  const hasAttachments = attachmentAdapter !== null
  const extraColSpan = hasAttachments ? 1 : 0
  const colSpan = Math.max(visibleColumns.length, 1) + extraColSpan
  const isGrouped = groupBy.isGrouped
  const isEmpty = sortedData.length === 0

  // When grouped, every data row is a leaf at the deepest level. Indent is
  // ADDED to the 16px cell baseline (never below it, so toggling group-by
  // never shifts the grid): 24px places row content under the deepest group
  // label (16px chevron + 8px gap), stepping 14px per additional level.
  const groupRowPadding =
    groupBy.levels.length > 0 ? 16 + 24 + (groupBy.levels.length - 1) * 14 : undefined

  // Accent rail for rows inside a group — same hue as the deepest header level.
  const rowRail = isGrouped ? groupRail(groupBy.levels.length - 1) : undefined

  // Stacked sticky offsets: each nesting level sticks below its parent's
  // header. Heights are measured (reported by GroupHeader) since they depend
  // on theme/typography; 50px approximates a header row until measured.
  const [levelHeights, setLevelHeights] = useState<Record<number, number>>({})
  const reportHeaderHeight = useCallback((level: number, height: number) => {
    setLevelHeights((prev) => {
      // Monotonic max per level: same-level headers reporting slightly
      // different heights must not overwrite each other every commit
      // (that would re-render forever). The tallest header wins.
      const current = prev[level]
      if (current !== undefined && height <= current + 0.5) return prev
      return { ...prev, [level]: height }
    })
  }, [])
  const baseStickyOffset = stickyHeader ? 39 : 0
  function stickyOffsetFor(level: number): number {
    let top = baseStickyOffset
    for (let l = 0; l < level; l++) top += levelHeights[l] ?? 50
    return top
  }

  // Aggregate cell renderer — same pipeline as data cells but without a row
  const renderAggregateCell = renderCell
    ? (col: ColumnDef, value: unknown) => renderCell(col, value, {} as RowData)
    : (col: ColumnDef, value: unknown) => defaultRenderCell(col, value)

  /* -----------------------------------------------------------------------
   * Render a single data row
   * ----------------------------------------------------------------------- */

  function renderRow(row: RowData, index: number) {
    const isClickable = !!onRowClick
    const key = row[rowKey] != null ? String(row[rowKey]) : `row-${index}`
    const rid = row[rowKey] != null ? String(row[rowKey]) : undefined
    const rowDropHandlers = rid && matching ? matching.getRowDropHandlers(rid) : undefined
    const isDropTarget = rid != null && matching?.dropTargetRowId === rid

    return (
      <TableRow
        key={key}
        data-row-id={rid}
        className={cn(
          isClickable && 'cursor-pointer',
          isDropTarget && 'bg-[var(--dt-primary)]/20 ring-1 ring-[var(--dt-primary)]',
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
        {...(rowDropHandlers ? {
          onDragEnter: rowDropHandlers.onDragEnter,
          onDragOver: rowDropHandlers.onDragOver,
          onDragLeave: rowDropHandlers.onDragLeave,
          onDrop: (e: React.DragEvent<HTMLTableRowElement>) => {
            rowDropHandlers.onDrop(e)
            // Refresh counts after a short delay to let the add complete
            setTimeout(() => refreshAttachmentCounts(), 500)
          },
        } : undefined)}
      >
        {hasAttachments && (() => {
          const rid = String(row[rowKey])
          const count = attachmentCounts[rid] ?? 0
          const clickable = count > 0 && onAttachmentClick
          return (
            <TableCell
              key="__attachments"
              className="text-center"
              style={rowRail ? { boxShadow: rowRail } : undefined}
            >
              {count > 0 ? (
                <button
                  type="button"
                  onClick={clickable ? (e) => { e.stopPropagation(); onAttachmentClick(rid, e) } : undefined}
                  className={cn(
                    "flex items-center justify-center gap-0.5 text-dt-primary mx-auto",
                    clickable && "hover:opacity-70 cursor-pointer transition-opacity",
                  )}
                  title={`${count} attachment${count > 1 ? 's' : ''} — click to view`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{count}</span>
                </button>
              ) : (
                <Paperclip className="w-3.5 h-3.5 mx-auto text-dt-muted opacity-20" />
              )}
            </TableCell>
          )
        })()}
        {visibleColumns.map((col) => {
          const value = row[col.id]
          const align = getAlign(col)
          const isFirstCol = col.id === visibleColumns[0]?.id
          return (
            <TableCell
              key={col.id}
              className={cn(
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
              )}
              style={{
                ...(isFirstCol && groupRowPadding !== undefined
                  ? { paddingLeft: groupRowPadding }
                  : {}),
                ...(isFirstCol && !hasAttachments && rowRail
                  ? { boxShadow: rowRail }
                  : {}),
              }}
            >
              {renderCell
                ? renderCell(col, value, row)
                : col.render
                  ? col.render(value, row)
                  : defaultRenderCell(col, value)}
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
    section: GroupedSection,
    parentPath: string,
  ): React.ReactNode {
    const path = joinGroupPath(parentPath, section.key)
    const collapsed = groupBy.isCollapsed(path)

    return (
      <Fragment key={path}>
        <GroupHeader
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
          stickyOffset={stickyOffsetFor(section.level)}
          onHeightChange={reportHeaderHeight}
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
   * Column resize — drag the right edge of a header cell. The chosen width
   * lands on the shared <colgroup>, so all rows follow; persisted via
   * useColumns. Pointer events cover mouse, touch, and pen; an unmount
   * mid-drag runs the same cleanup so no document listeners or body styles
   * leak.
   * ----------------------------------------------------------------------- */

  const resizeCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeCleanupRef.current?.(), [])

  function startResize(e: React.PointerEvent, columnId: string) {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    const startWidth = th ? th.getBoundingClientRect().width : 150
    const onMove = (ev: PointerEvent) => {
      columnState.setColumnWidth(columnId, Math.max(60, Math.round(startWidth + (ev.clientX - startX))))
    }
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', cleanup)
      document.removeEventListener('pointercancel', cleanup)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      resizeCleanupRef.current = null
    }
    resizeCleanupRef.current = cleanup
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', cleanup)
    document.addEventListener('pointercancel', cleanup)
  }

  /* -----------------------------------------------------------------------
   * Render
   * ----------------------------------------------------------------------- */

  return (
    <Table className={className}>
      {/* Single source of truth for column widths — header, data, and group
          rows all follow these <col> widths under table-fixed layout. */}
      <colgroup>
        {hasAttachments && <col style={{ width: 50 }} />}
        {visibleColumns.map((col) => {
          const width = columnState.widths[col.id] ?? col.width
          return <col key={col.id} style={width != null ? { width } : undefined} />
        })}
      </colgroup>
      <TableHeader className={cn(stickyHeader && 'sticky top-0 z-20 bg-dt-bg')}>
        <TableRow>
          {hasAttachments && (
            <TableHead scope="col" className="text-center">
              <Paperclip className="w-3.5 h-3.5 mx-auto text-dt-muted" />
            </TableHead>
          )}
          {visibleColumns.map((col) => {
            const align = getAlign(col)
            const isSortable = col.sortable !== false

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
                scope="col"
                aria-sort={ariaSortValue}
                className={cn(
                  'relative',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                )}
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
                {/* Drag handle on the column's right edge */}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={(e) => startResize(e, col.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize"
                  className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-dt-primary/50"
                  style={{ touchAction: 'none' }}
                />
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
          const path = joinGroupPath('', section.key)
          const collapsed = groupBy.isCollapsed(path)

          return (
            <TableBody key={path}>
              <GroupHeader
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
                stickyOffset={stickyOffsetFor(section.level)}
                onHeightChange={reportHeaderHeight}
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
