import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

const VIEWPORT_MARGIN = 8
const TRIGGER_GAP = 4
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  'aria-label': string
  contentClassName?: string
}

interface Position {
  left: number
  top: number
}

function getTriggerElement(container: HTMLDivElement): HTMLElement {
  return container.querySelector<HTMLElement>('[aria-haspopup="dialog"], button, [tabindex]') ?? container
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function Popover({
  trigger,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  'aria-label': ariaLabel,
  contentClassName,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [position, setPosition] = useState<Position | null>(null)
  const triggerContainerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : uncontrolledOpen

  const setOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  function handleTriggerClick(event: React.MouseEvent<HTMLDivElement>) {
    const container = triggerContainerRef.current
    if (!container) return
    const triggerElement = getTriggerElement(container)
    if (triggerElement.contains(event.target as Node)) setOpen(!isOpen)
  }

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }

    const triggerContainer = triggerContainerRef.current
    const panel = panelRef.current
    if (!triggerContainer || !panel) return
    const triggerElement = getTriggerElement(triggerContainer)
    const activePanel = panel
    const activeTriggerContainer = triggerContainer

    function measure() {
      const triggerRect = triggerElement.getBoundingClientRect()
      const panelRect = activePanel.getBoundingClientRect()

      let left = triggerRect.left
      if (left + panelRect.width > window.innerWidth - VIEWPORT_MARGIN) {
        left = triggerRect.right - panelRect.width
      }
      left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - panelRect.width)

      let top = triggerRect.bottom + TRIGGER_GAP
      if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
        top = triggerRect.top - panelRect.height - TRIGGER_GAP
      }
      top = clamp(top, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - panelRect.height)

      setPosition({ left, top })
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (activeTriggerContainer.contains(target) || activePanel.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerElement.focus()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...activePanel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      if (focusable.length === 0) {
        event.preventDefault()
        activePanel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !activePanel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !activePanel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    measure()
    activePanel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(activePanel)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      resizeObserver?.disconnect()
    }
  }, [isOpen, setOpen])

  return (
    <>
      <div ref={triggerContainerRef} className="contents" onClick={handleTriggerClick}>
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          aria-label={ariaLabel}
          className={cn(
            'fixed z-50 rounded-lg border border-dt-border bg-dt-bg-secondary shadow-xl',
            contentClassName,
          )}
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            maxWidth: Math.max(0, window.innerWidth - (VIEWPORT_MARGIN * 2)),
            maxHeight: Math.max(0, window.innerHeight - (VIEWPORT_MARGIN * 2)),
            overflow: 'auto',
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

Popover.displayName = 'Popover'
