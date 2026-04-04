import { Paperclip } from 'lucide-react'
import { useMatchingContext } from '../../matching-context'

export function BulkDropZone() {
  const matching = useMatchingContext()
  if (!matching?.bulkDropVisible) return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-dt-bg/80 backdrop-blur-sm border-2 border-dashed border-dt-primary rounded-lg pointer-events-none">
      <div className="text-center">
        <Paperclip className="w-12 h-12 mx-auto mb-3 text-dt-primary" />
        <p className="text-lg font-medium text-dt-text">Drop files to bulk match</p>
        <p className="text-sm text-dt-muted mt-1">Files will be OCR'd and matched to transactions</p>
      </div>
    </div>
  )
}
