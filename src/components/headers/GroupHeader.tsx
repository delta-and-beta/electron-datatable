import React, { useRef, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatAggregateValue } from '../../lib/format-aggregate'
import type { RowData, ColumnDef } from '../../types'

/* ---------------------------------------------------------------------------
 * Props
 * --------------------------------------------------------------------------- */

export interface GroupHeaderProps<T extends object = RowData> {
  /** Display text for the group (e.g., "2024-01", "Food") */
  groupKey: string
  /** Column label shown as a badge for subgroups */
  fieldLabel: string
  /** Nesting depth: 0 = top level */
  level: number
  /** Number of records in this group */
  count: number
  /** Visible columns to render cells for */
  columns: ColumnDef<T>[]
  /** Aggregated sums keyed by column id */
  sums: Record<string, number>
  /** Whether this group is collapsed */
  isCollapsed: boolean
  /** Toggle collapse/expand */
  onToggle: () => void
  /** Pixel offset from the top for sticky positioning (default: 39 = thead height) */
  stickyOffset?: number
  /** Optional cell renderer matching Content's renderCell pipeline */
  renderCell?: (column: ColumnDef<T>, value: unknown) => React.ReactNode
  /** Extra columns prepended before user columns (e.g., attachment column) */
  extraColSpan?: number
  /** Whether a leading structural selection cell is present */
  selectionEnabled?: boolean
  /** Whether the structural selection cell is frozen */
  selectionFrozen?: boolean
  /** Widths resolved from persisted resize state before static column widths */
  resolvedWidths?: Record<string, string | number | undefined>
  /** Sticky-left offsets keyed by frozen visible column id */
  frozenOffsets?: Record<string, number>
  /** Last frozen column, which receives the frozen-region divider */
  lastFrozenId?: string
}

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

/** Walk up the DOM to find the nearest scrollable ancestor */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement
  while (current) {
    const style = getComputedStyle(current)
    const overflow = style.overflow || style.overflowY
    if (overflow === 'auto' || overflow === 'scroll') {
      return current
    }
    current = current.parentElement
  }
  return null
}

/** Check whether a column should show an aggregated sum */
function isAggregatable<T extends object>(col: ColumnDef<T>): boolean {
  return (col.type === 'currency' || col.type === 'number') && col.sumInGroup !== false
}

/** Resolve effective text alignment — currency/number default to right */
function getAlign<T extends object>(col: ColumnDef<T>): 'left' | 'center' | 'right' {
  return col.align ?? ((col.type === 'currency' || col.type === 'number') ? 'right' : 'left')
}

/** Level-tinted group-header background — strongest at the top level, lighter when nested.
 *  Higher-contrast tints so grouped rows stand out clearly from data rows. */
function groupBg(level: number, stuck: boolean): string {
  const tint = level <= 0 ? 32 : level === 1 ? 21 : 13
  const base = stuck ? 'var(--dt-bg, #14142a)' : 'var(--dt-bg-secondary, #1f2937)'
  return `color-mix(in srgb, var(--dt-primary, #6366f1) ${tint}%, ${base})`
}

/** Left accent-bar colour for a group row — fades with depth. */
function groupAccent(level: number): string {
  const alpha = level <= 0 ? 90 : level === 1 ? 55 : 30
  return `color-mix(in srgb, var(--dt-primary, #6366f1) ${alpha}%, transparent)`
}

/* ---------------------------------------------------------------------------
 * GroupHeader
 *
 * Renders two <tr> elements:
 *   1. An invisible sentinel row used to detect when the header becomes sticky.
 *   2. The visible sticky header row that changes appearance when "stuck"
 *      and animates a push-up effect when the next group header approaches.
 * --------------------------------------------------------------------------- */

export function GroupHeader<T extends object = RowData>({
  groupKey,
  fieldLabel,
  level,
  count,
  columns,
  sums,
  isCollapsed,
  onToggle,
  stickyOffset = 39,
  renderCell,
  extraColSpan = 0,
  selectionEnabled = false,
  selectionFrozen = false,
  resolvedWidths = {},
  frozenOffsets = {},
  lastFrozenId,
}: GroupHeaderProps<T>) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLTableRowElement>(null)
  const cellRef = useRef<HTMLTableRowElement>(null)
  const isStuckRef = useRef(false)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const header = headerRef.current
    if (!sentinel || !header) return

    const scrollParent = findScrollParent(sentinel)
    if (!scrollParent) return

    let rafId: number | null = null

    function onScroll() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!sentinel || !header) return

        const containerRect = scrollParent!.getBoundingClientRect()
        const sentinelRect = sentinel.getBoundingClientRect()
        const topThreshold = containerRect.top + stickyOffset

        // Only update React state on transitions to avoid re-renders
        const stuck = sentinelRect.top < topThreshold
        if (isStuckRef.current !== stuck) {
          isStuckRef.current = stuck
          setIsStuck(stuck)
        }

        // Push-up: use cellRef (the visible <tr>) to get all <td>s
        const row = cellRef.current
        if (!row) return
        const cells = row.querySelectorAll<HTMLTableCellElement>('td')
        if (cells.length === 0) return

        if (stuck) {
          // Find the next group sentinel using indexOf (bulletproof)
          const allSentinels = Array.from(
            scrollParent!.querySelectorAll<HTMLElement>('[data-group-sentinel]')
          )
          const myIndex = allSentinels.indexOf(sentinel)
          const nextSentinel = myIndex >= 0 ? allSentinels[myIndex + 1] : undefined

          if (nextSentinel) {
            const nextRect = nextSentinel.getBoundingClientRect()
            const headerHeight = row.getBoundingClientRect().height
            const overlap = topThreshold + headerHeight - nextRect.top

            const top = overlap > 0 ? stickyOffset - overlap : stickyOffset
            row.style.top = `${top}px`
            cells.forEach((cell) => {
              cell.style.top = `${top}px`
            })
          } else {
            row.style.top = `${stickyOffset}px`
            cells.forEach((cell) => {
              cell.style.top = `${stickyOffset}px`
            })
          }
        } else {
          row.style.top = `${stickyOffset}px`
          cells.forEach((cell) => {
            cell.style.top = `${stickyOffset}px`
          })
        }
      })
    }

    scrollParent.addEventListener('scroll', onScroll, { passive: true })
    // Run once to set initial state
    onScroll()

    return () => {
      scrollParent.removeEventListener('scroll', onScroll)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [stickyOffset])

  // Reduced indentation, more vertical breathing room, and level-aware shading.
  const paddingLeft = 12 + level * 14
  const padY = level <= 0 ? 8 : 6
  const bgColor = groupBg(level, isStuck)
  const accentColor = groupAccent(level)

  return (
    <>
      {/* Sentinel row — invisible, used for sticky detection */}
      <tr
        ref={headerRef}
        aria-hidden="true"
        style={{ height: 0, padding: 0, border: 'none' }}
      >
        <td colSpan={columns.length + extraColSpan} style={{ height: 0, padding: 0, border: 'none' }}>
          <div ref={sentinelRef} data-group-sentinel="" style={{ height: 0 }} />
        </td>
      </tr>

      {/* Visible sticky header row */}
      <tr
        ref={cellRef}
        className={cn(
          'group/header sticky z-10 cursor-pointer',
        )}
        style={{ top: stickyOffset }}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-label={`${fieldLabel}: ${groupKey}, ${count} records, ${isCollapsed ? 'collapsed' : 'expanded'}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        {selectionEnabled && (
          <td
            key="__selection"
            className={cn(
              'sticky border-b border-r border-dt-border transition-colors duration-150',
              selectionFrozen && 'dt-group-frozen-cell z-20',
            )}
            style={{
              top: stickyOffset,
              left: selectionFrozen ? 0 : undefined,
              width: '44px',
              minWidth: '44px',
              backgroundColor: bgColor,
              paddingTop: padY,
              paddingBottom: padY,
            }}
          />
        )}
        {extraColSpan - (selectionEnabled ? 1 : 0) > 0 && (
          <td
            key="__extra"
            className={cn('sticky border-b border-r border-dt-border transition-colors duration-150')}
            style={{ top: stickyOffset, width: '50px', backgroundColor: bgColor, paddingTop: padY, paddingBottom: padY }}
          />
        )}
        {columns.map((col, idx) => {
          const isFirst = idx === 0
          const isFrozen = Object.prototype.hasOwnProperty.call(frozenOffsets, col.id)
          const isFrozenEdge = col.id === lastFrozenId
          const frozenStyle = isFrozen ? { left: frozenOffsets[col.id] } : {}
          const width = resolvedWidths[col.id] ?? col.width

          // The first cell is always reserved for the group label (chevron +
          // badge + key + count), even if the underlying column is aggregatable.
          if (isFirst) {
            return (
              <td
                key={col.id}
                className={cn(
                  'sticky pr-3 border-b border-dt-border transition-colors duration-150',
                  idx < columns.length - 1 && 'border-r border-dt-border',
                  isFrozen && 'dt-group-frozen-cell z-20',
                  isFrozenEdge && 'dt-frozen-edge',
                )}
                style={{
                  top: stickyOffset,
                  ...frozenStyle,
                  paddingLeft,
                  paddingTop: padY,
                  paddingBottom: padY,
                  width,
                  backgroundColor: bgColor,
                  boxShadow: `inset 3px 0 0 0 ${accentColor}`,
                }}
              >
                <div className="flex items-center gap-2">
                  {/* Collapse/expand chevron */}
                  <span className="flex-shrink-0 text-dt-muted">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>

                  {/* Grouped field name on top, value wrapped as a pill below */}
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider leading-none text-dt-muted">
                      {fieldLabel}
                    </span>
                    <span className="inline-block max-w-full truncate rounded-full border border-dt-border bg-[var(--dt-bg,#14142a)] px-2.5 py-0.5 text-sm font-semibold leading-tight text-dt-text">
                      {groupKey}
                    </span>
                  </span>

                  {/* Record count — plain number at the right edge of the first column */}
                  <span className="ml-auto flex-shrink-0 text-xs font-medium tabular-nums text-dt-muted">
                    {count}
                  </span>
                </div>
              </td>
            )
          }

          const align = getAlign(col)

          if (isAggregatable(col) && sums[col.id] !== undefined) {
            // Aggregatable cell: show formatted sum with positive/negative color
            const value = sums[col.id]
            return (
              <td
                key={col.id}
                className={cn(
                  'sticky px-4 tabular-nums border-b border-dt-border transition-colors duration-150',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  value < 0 ? 'text-dt-negative' : 'text-dt-positive',
                  idx < columns.length - 1 && 'border-r border-dt-border',
                  isFrozen && 'dt-group-frozen-cell z-20',
                  isFrozenEdge && 'dt-frozen-edge',
                )}
                style={{
                  top: stickyOffset,
                  ...frozenStyle,
                  width,
                  backgroundColor: bgColor,
                  paddingTop: padY,
                  paddingBottom: padY,
                }}
              >
                {renderCell
                  ? renderCell(col, value)
                  : col.render
                    ? col.render(value, {} as T)
                    : formatAggregateValue(col, value)}
              </td>
            )
          }

          // Other cells: empty
          return (
            <td
              key={col.id}
              className={cn(
                'sticky px-4 border-b border-dt-border transition-colors duration-150',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                idx < columns.length - 1 && 'border-r border-dt-border',
                isFrozen && 'dt-group-frozen-cell z-20',
                isFrozenEdge && 'dt-frozen-edge',
              )}
              style={{
                top: stickyOffset,
                ...frozenStyle,
                width,
                backgroundColor: bgColor,
                paddingTop: padY,
                paddingBottom: padY,
              }}
            />
          )
        })}
      </tr>
    </>
  )
}

GroupHeader.displayName = 'GroupHeader'
