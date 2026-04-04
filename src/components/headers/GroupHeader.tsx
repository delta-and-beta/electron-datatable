import React, { useRef, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatAggregateValue } from '../../lib/format-aggregate'
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
 *   2. The visible sticky header row that changes appearance when "stuck"
 *      and animates a push-up effect when the next group header approaches.
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
}: GroupHeaderProps) {
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

  const paddingLeft = 16 + level * 24

  const bgClass = isStuck
    ? 'bg-[color-mix(in_srgb,var(--dt-bg,#1a1a2e)_90%,transparent)]'
    : 'bg-dt-bg-secondary'

  return (
    <>
      {/* Sentinel row — invisible, used for sticky detection */}
      <tr
        ref={headerRef}
        aria-hidden="true"
        style={{ height: 0, padding: 0, border: 'none' }}
      >
        <td colSpan={columns.length} style={{ height: 0, padding: 0, border: 'none' }}>
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
        onClick={onToggle}
      >
        {columns.map((col, idx) => {
          const isFirst = idx === 0

          // The first cell is always reserved for the group label (chevron +
          // badge + key + count), even if the underlying column is aggregatable.
          if (isFirst) {
            return (
              <td
                key={col.id}
                className={cn('sticky py-1.5 pr-4 transition-colors duration-150', bgClass)}
                style={{
                  top: stickyOffset,
                  paddingLeft,
                  width: col.width,
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

                  {/* Field label badge (subgroups only) */}
                  {level > 0 && (
                    <span className="flex-shrink-0 rounded bg-dt-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dt-muted">
                      {fieldLabel}
                    </span>
                  )}

                  {/* Group key */}
                  <span className="truncate font-semibold text-dt-text">
                    {groupKey}
                  </span>

                  {/* Record count badge */}
                  <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs text-dt-muted ring-1 ring-dt-border">
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
                  'sticky px-4 py-1.5 tabular-nums transition-colors duration-150',
                  bgClass,
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  value < 0 ? 'text-dt-negative' : 'text-dt-positive',
                )}
                style={{
                  top: stickyOffset,
                  width: col.width,
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
                'sticky px-4 py-1.5 transition-colors duration-150',
                bgClass,
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
              )}
              style={{
                top: stickyOffset,
                width: col.width,
              }}
            />
          )
        })}
      </tr>
    </>
  )
}

GroupHeader.displayName = 'GroupHeader'
