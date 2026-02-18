import { Layers } from 'lucide-react'
import { cn } from '../../lib/utils'

interface GroupByToolbarButtonProps {
  activeCount: number
  isOpen: boolean
  onClick: () => void
  className?: string
}

export function GroupByToolbarButton({ activeCount, isOpen, onClick, className }: GroupByToolbarButtonProps) {
  const isActive = activeCount > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
        'border-gray-600 text-gray-300 hover:bg-gray-700',
        isActive && 'border-blue-500/50 text-blue-400',
        isOpen && 'bg-gray-700',
        className,
      )}
    >
      <Layers className="w-4 h-4" />
      {isActive ? `Grouped by ${activeCount} field${activeCount > 1 ? 's' : ''}` : 'Group'}
    </button>
  )
}
