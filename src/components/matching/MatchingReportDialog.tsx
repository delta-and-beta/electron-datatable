import { useEffect, useRef, type ReactNode } from 'react'
import { useMatchingContext } from '../../matching-context'
import { MatchingReportContent } from './MatchingReportContent'

interface MatchingReportDialogProps {
  wrapper?: (props: { open: boolean; onClose: () => void; children: ReactNode }) => ReactNode
}

export function MatchingReportDialog({ wrapper }: MatchingReportDialogProps) {
  const matching = useMatchingContext()
  if (!matching) return null

  const isOpen = matching.state !== 'idle' && matching.state !== 'done'
  const content = <MatchingReportContent />

  if (wrapper) {
    return <>{wrapper({ open: isOpen, onClose: matching.reset, children: content })}</>
  }

  if (!isOpen) return null

  return <BuiltInModal onClose={matching.reset}>{content}</BuiltInModal>
}

function BuiltInModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-50 w-full max-w-3xl overflow-hidden rounded-lg border border-dt-border bg-dt-bg shadow-xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
