import { useRef, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ---------------------------------------------------------------------------
 * Default sum formatter
 * --------------------------------------------------------------------------- */

function defaultFormatSum(amount: number, label?: string): string {
  const sign = amount < 0 ? '-' : '+'
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return label ? `${sign}${label} ${formatted}` : `${sign}${formatted}`
}

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
  /** Optional aggregated sum to display */
  sumAmount?: number
  /** Optional label for the sum (e.g., "HKD") */
  sumLabel?: string
  /** Whether this group is collapsed */
  isCollapsed: boolean
  /** Toggle collapse/expand */
  onToggle: () => void
  /** Number of columns the header should span */
  colSpan: number
  /** Pixel offset from the top for sticky positioning (default: 39 = thead height) */
  stickyOffset?: number
  /** Custom formatter for the sum display */
  formatSum?: (amount: number) => string
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
  sumAmount,
  sumLabel,
  isCollapsed,
  onToggle,
  colSpan,
  stickyOffset = 39,
  formatSum,
}: GroupHeaderProps) {
  const sentinelRef = useRef<HTMLTableRowElement>(null)
  const headerRef = useRef<HTMLTableRowElement>(null)
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

        // Determine if this header is stuck
        const stuck = sentinelRect.top < topThreshold
        setIsStuck(stuck)

        // Push-up: find the next sentinel in DOM order and calculate overlap
        const cell = header.querySelector('td') as HTMLTableCellElement | null
        if (!cell) return

        if (stuck) {
          // Find the next group sentinel after this one
          const allSentinels = scrollParent!.querySelectorAll<HTMLElement>(
            '[data-group-sentinel]'
          )
          let nextSentinel: HTMLElement | null = null
          let found = false
          for (const s of allSentinels) {
            if (found) {
              nextSentinel = s
              break
            }
            if (s === sentinel.querySelector('[data-group-sentinel]')) {
              found = true
            }
          }

          if (nextSentinel) {
            const nextRect = nextSentinel.getBoundingClientRect()
            const headerHeight = header.getBoundingClientRect().height
            const overlap = topThreshold + headerHeight - nextRect.top

            if (overlap > 0) {
              // Push the header up by the overlap amount
              cell.style.top = `${stickyOffset - overlap}px`
            } else {
              cell.style.top = `${stickyOffset}px`
            }
          } else {
            cell.style.top = `${stickyOffset}px`
          }
        } else {
          cell.style.top = `${stickyOffset}px`
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

  const formattedSum =
    sumAmount !== undefined
      ? formatSum
        ? formatSum(sumAmount)
        : defaultFormatSum(sumAmount, sumLabel)
      : null

  return (
    <>
      {/* Sentinel row — invisible, used for sticky detection */}
      <tr
        ref={sentinelRef}
        aria-hidden="true"
        style={{ height: 0, padding: 0, border: 'none' }}
      >
        <td colSpan={colSpan} style={{ height: 0, padding: 0, border: 'none' }}>
          <div data-group-sentinel="" style={{ height: 0 }} />
        </td>
      </tr>

      {/* Visible sticky header row */}
      <tr
        ref={headerRef}
        className="group/header sticky z-10 cursor-pointer"
        style={{ top: stickyOffset }}
        onClick={onToggle}
      >
        <td
          colSpan={colSpan}
          className={cn(
            'sticky px-2 py-1.5 transition-colors duration-150',
            isStuck
              ? 'bg-dt-bg/80 shadow-[0_1px_3px_rgba(0,0,0,0.3)] backdrop-blur-sm'
              : 'bg-dt-bg-secondary'
          )}
          style={{
            top: stickyOffset,
            paddingLeft,
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

            {/* Sum display (right-aligned) */}
            {formattedSum !== null && (
              <span
                className={cn(
                  'ml-auto flex-shrink-0 tabular-nums',
                  sumAmount !== undefined && sumAmount < 0
                    ? 'text-dt-negative'
                    : 'text-dt-positive'
                )}
              >
                {formattedSum}
              </span>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}

GroupHeader.displayName = 'GroupHeader'
