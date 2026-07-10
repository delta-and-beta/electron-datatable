import React, { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatAggregateValue } from '../../lib/format-aggregate'
import { groupBg, groupRail } from './group-style'
import type { ColumnDef } from '../../types'

/* ---------------------------------------------------------------------------
 * Props
 * --------------------------------------------------------------------------- */

export interface GroupHeaderProps {
  /** Display text for the group (e.g., "2024-01", "Food") */
  groupKey: string
  /** Column label shown as a badge for subgroups */
  fieldLabel: string
  /** Nesting depth: 0 = top level */
  level: number
  /** Number of records in this group */
  count: number
  /** Visible columns to render cells for */
  columns: ColumnDef[]
  /** Aggregated sums keyed by column id */
  sums: Record<string, number>
  /** Whether this group is collapsed */
  isCollapsed: boolean
  /** Toggle collapse/expand */
  onToggle: () => void
  /** Pixel offset from the top for sticky positioning (default: 39 = thead height) */
  stickyOffset?: number
  /** Optional cell renderer matching Content's renderCell pipeline */
  renderCell?: (column: ColumnDef, value: unknown) => React.ReactNode
  /** Extra columns prepended before user columns (e.g., attachment column) */
  extraColSpan?: number
  /** Reports the measured header-row height so ancestors can stack sticky offsets */
  onHeightChange?: (level: number, height: number) => void
}

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

/** Nearest ancestor that establishes the sticky scrollport (overflow-y not visible) */
function findStickyRoot(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement
  while (current) {
    const overflowY = getComputedStyle(current).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden' || overflowY === 'overlay') {
      return current
    }
    current = current.parentElement
  }
  return null
}

/** Check whether a column should show an aggregated sum */
function isAggregatable(col: ColumnDef): boolean {
  return (col.type === 'currency' || col.type === 'number') && col.sumInGroup !== false
}

/** Resolve effective text alignment — currency/number default to right */
function getAlign(col: ColumnDef): 'left' | 'center' | 'right' {
  return col.align ?? ((col.type === 'currency' || col.type === 'number') ? 'right' : 'left')
}

/* ---------------------------------------------------------------------------
 * GroupHeader
 *
 * Renders two <tr> elements:
 *   1. An invisible sentinel row used to detect when the header becomes sticky.
 *   2. The visible sticky header row. The label band spans the leading run of
 *      non-aggregatable columns; the disclosure control is a real <button>
 *      inside the first cell so the row keeps its table semantics.
 *
 * The sticky `top` is owned exclusively by the positioning effect (never set
 * from JSX), so React re-renders cannot clobber the push-up offset.
 * --------------------------------------------------------------------------- */

export function GroupHeader({
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
  onHeightChange,
}: GroupHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const cellRef = useRef<HTMLTableRowElement>(null)
  const isStuckRef = useRef(false)
  const positionRef = useRef<(() => void) | null>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const row = cellRef.current
    if (!sentinel || !row) return

    const stickyRoot = findStickyRoot(sentinel)
    let rafId: number | null = null

    function applyTop(top: number) {
      if (!row) return
      row.style.top = `${top}px`
      row.querySelectorAll<HTMLTableCellElement>('td').forEach((cell) => {
        cell.style.top = `${top}px`
      })
    }

    function position() {
      if (!sentinel || !row) return

      const containerTop = stickyRoot ? stickyRoot.getBoundingClientRect().top : 0
      const sentinelRect = sentinel.getBoundingClientRect()
      const topThreshold = containerTop + stickyOffset

      // Only update React state on transitions to avoid re-renders
      const stuck = sentinelRect.top < topThreshold
      if (isStuckRef.current !== stuck) {
        isStuckRef.current = stuck
        setIsStuck(stuck)
      }

      if (stuck) {
        // Push-up: only a following header at the same or a shallower level
        // displaces this one — deeper (child) headers stack below it instead.
        const scope = stickyRoot ?? document
        const allSentinels = Array.from(
          scope.querySelectorAll<HTMLElement>('[data-group-sentinel]')
        )
        const myIndex = allSentinels.indexOf(sentinel)
        let nextSentinel: HTMLElement | undefined
        if (myIndex >= 0) {
          for (let i = myIndex + 1; i < allSentinels.length; i++) {
            const lv = Number(allSentinels[i].dataset.groupSentinel)
            if (!Number.isNaN(lv) && lv <= level) {
              nextSentinel = allSentinels[i]
              break
            }
          }
        }

        if (nextSentinel) {
          const nextRect = nextSentinel.getBoundingClientRect()
          const headerHeight = row.getBoundingClientRect().height
          const overlap = topThreshold + headerHeight - nextRect.top
          applyTop(overlap > 0 ? stickyOffset - overlap : stickyOffset)
        } else {
          applyTop(stickyOffset)
        }
      } else {
        applyTop(stickyOffset)
      }
    }

    positionRef.current = position

    function onScroll() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        position()
      })
    }

    // Capture-phase listener on window sees scroll events from every
    // scroll container (scroll events don't bubble), so the handler works
    // no matter which ancestor actually scrolls.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    position()

    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
      positionRef.current = null
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [stickyOffset, level])

  // Reposition after every commit — collapse/expand and data changes move
  // rows without firing a scroll event, which would leave stale offsets.
  useEffect(() => {
    positionRef.current?.()
  })

  // Report measured height so Content can stack deeper levels' sticky offsets.
  useLayoutEffect(() => {
    if (!onHeightChange || !cellRef.current) return
    const height = cellRef.current.getBoundingClientRect().height
    if (height > 0) onHeightChange(level, height)
  })

  // Indent is added on top of the 16px cell baseline; deeper levels step by 14px.
  const paddingLeft = 16 + level * 14
  const padY = level <= 0 ? 8 : 6
  const bgColor = groupBg(level, isStuck)
  const railShadow = groupRail(level)

  // The label band spans the leading run of non-aggregatable columns so the
  // group label and count are not imprisoned in column 1's width. At least
  // one column is always reserved for the label.
  const firstAggregatable = columns.findIndex((c) => isAggregatable(c))
  const leadSpan = firstAggregatable === -1 ? Math.max(columns.length, 1) : Math.max(firstAggregatable, 1)

  const sumsSummary = columns
    .filter((c) => isAggregatable(c) && sums[c.id] !== undefined)
    .map((c) => `${c.label} total ${formatAggregateValue(c, sums[c.id])}`)
    .join(', ')

  const ariaLabel = `${fieldLabel}: ${groupKey}, ${count} record${count === 1 ? '' : 's'}${
    sumsSummary ? `, ${sumsSummary}` : ''
  }, ${isCollapsed ? 'collapsed' : 'expanded'}`

  return (
    <>
      {/* Sentinel row — invisible, used for sticky detection; tagged with its
          level so push-up can ignore deeper (stacking) headers */}
      <tr aria-hidden="true" style={{ height: 0, padding: 0, border: 'none' }}>
        <td colSpan={columns.length + extraColSpan} style={{ height: 0, padding: 0, border: 'none' }}>
          <div ref={sentinelRef} data-group-sentinel={level} style={{ height: 0 }} />
        </td>
      </tr>

      {/* Visible sticky header row. Shallower levels get a higher z-index so
          a child header pushed up past its parent slides underneath the
          parent band (all below the thead's z-20). */}
      <tr
        ref={cellRef}
        className="group/header sticky cursor-pointer"
        style={{ zIndex: 12 - Math.min(level, 2) }}
        onClick={onToggle}
      >
        {extraColSpan > 0 && (
          <td
            key="__extra"
            className={cn('sticky border-b border-r border-dt-border transition-colors duration-150')}
            style={{
              backgroundColor: bgColor,
              paddingTop: padY,
              paddingBottom: padY,
              boxShadow: railShadow,
            }}
          />
        )}

        {/* Label band — chevron + field name over value pill + count */}
        <td
          colSpan={leadSpan}
          className={cn(
            'sticky pr-3 border-b border-dt-border transition-colors duration-150',
            leadSpan < columns.length && 'border-r border-dt-border',
          )}
          style={{
            paddingLeft,
            paddingTop: padY,
            paddingBottom: padY,
            backgroundColor: bgColor,
            ...(extraColSpan === 0 ? { boxShadow: railShadow } : {}),
          }}
        >
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex min-w-0 max-w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
          >
            {/* Collapse/expand chevron */}
            <span className="flex-shrink-0 text-dt-muted">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>

            {/* Grouped field name on top; value pill + count below */}
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider leading-none text-dt-muted">
                {fieldLabel}
              </span>
              <span className="flex min-w-0 max-w-full items-center gap-1.5">
                <span className="inline-block min-w-0 truncate rounded-full border border-dt-border bg-[var(--dt-bg,#14142a)] px-2.5 py-0.5 text-sm font-semibold leading-tight text-dt-text">
                  {groupKey}
                </span>
                <span className="flex-shrink-0 text-xs font-medium tabular-nums text-dt-muted">
                  {count}
                </span>
              </span>
            </span>
          </button>
        </td>

        {columns.slice(leadSpan).map((col, j) => {
          const idx = leadSpan + j
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
                )}
                style={{
                  backgroundColor: bgColor,
                  paddingTop: padY,
                  paddingBottom: padY,
                }}
              >
                {renderCell
                  ? renderCell(col, value)
                  : col.render
                    ? col.render(value, {} as Record<string, unknown>)
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
              )}
              style={{
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
