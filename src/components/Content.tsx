import { Fragment } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Paperclip } from 'lucide-react'
import { cn } from '../lib/utils'
import { formatDate, formatNumber, formatCurrency } from '../lib/format'
import { useDataTable } from '../context'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'
import { GroupHeader } from './headers'
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
  const { sortedData, groupedData, columns, columnState, groupBy, sort, rowKey, attachmentAdapter, attachmentCounts } = useDataTable()

  // Resolve visible columns in display order
  const visibleColumns = columnState.visibleColumns
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is ColumnDef => c !== undefined)

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
    ? (col: ColumnDef, value: unknown) => renderCell(col, value, {} as RowData)
    : (col: ColumnDef, value: unknown) => defaultRenderCell(col, value)

  /* -----------------------------------------------------------------------
   * Render a single data row
   * ----------------------------------------------------------------------- */

  function renderRow(row: RowData, index: number) {
    const isClickable = !!onRowClick
    const key = row[rowKey] != null ? String(row[rowKey]) : `row-${index}`

    return (
      <TableRow
        key={key}
        data-row-id={row[rowKey] != null ? String(row[rowKey]) : undefined}
        className={cn(
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
          <TableCell key="__attachments" className="text-center" style={{ width: '50px' }}>
            {(attachmentCounts[String(row[rowKey])] ?? 0) > 0 ? (
              <span className="flex items-center justify-center gap-0.5 text-dt-primary">
                <Paperclip className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{attachmentCounts[String(row[rowKey])]}</span>
              </span>
            ) : (
              <Paperclip className="w-3.5 h-3.5 mx-auto text-dt-muted opacity-20" />
            )}
          </TableCell>
        )}
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
                ...(col.width ? { width: col.width } : {}),
                ...(isFirstCol && groupRowIndent !== undefined
                  ? { paddingLeft: groupRowIndent }
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
    const path = parentPath ? `${parentPath}/${section.key}` : section.key
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
                style={{ width: columnState.widths[col.id] ?? col.width }}
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
                  onMouseDown={(e) => startResize(e, col.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize"
                  className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-dt-primary/50"
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
          const path = section.key
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
                extraColSpan={extraColSpan}
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
