import { Filter } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FilterToolbarButtonProps {
  activeCount: number
  enabled: boolean
  isOpen: boolean
  onClick?: () => void
  onToggleEnabled: (enabled: boolean) => void
  className?: string
}

export function FilterToolbarButton({
  activeCount,
  enabled,
  isOpen,
  onClick,
  onToggleEnabled,
  className,
}: FilterToolbarButtonProps) {
  const isActive = activeCount > 0 && enabled

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
          'border-gray-600 text-gray-300 hover:bg-gray-700',
          isActive && 'border-dt-primary/50 text-dt-primary',
          isOpen && 'bg-gray-700',
          className,
        )}
      >
        <Filter className="w-4 h-4" />
        {isActive
          ? `${activeCount} filter${activeCount > 1 ? 's' : ''}`
          : 'Filter'}
      </button>
      {activeCount > 0 && (
        <button
          onClick={() => onToggleEnabled(!enabled)}
          className={cn(
            'h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors text-xs',
            enabled
              ? 'border-dt-primary/50 text-dt-primary hover:bg-gray-700'
              : 'border-gray-600 text-gray-500 hover:bg-gray-700',
          )}
          aria-label={enabled ? 'Disable filters' : 'Enable filters'}
          title={enabled ? 'Disable filters' : 'Enable filters'}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      )}
    </div>
  )
}
