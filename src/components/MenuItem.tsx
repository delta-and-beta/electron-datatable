import { useId, type ReactElement } from 'react'
import { cn } from '../lib/utils'

export interface MenuItemProps {
  icon?: ReactElement
  label: string
  onSelect: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  disabledReason?: string
}

export function MenuItem({
  icon,
  label,
  onSelect,
  variant = 'default',
  disabled = false,
  disabledReason,
}: MenuItemProps) {
  const descriptionId = useId()
  const hasDisabledReason = disabled && disabledReason !== undefined

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        title={hasDisabledReason ? disabledReason : undefined}
        aria-describedby={hasDisabledReason ? descriptionId : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-dt-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dt-primary/60',
          variant === 'danger' && 'text-dt-negative',
          disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        )}
      >
        {icon ? <span aria-hidden="true" className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
        <span>{label}</span>
      </button>
      {hasDisabledReason ? (
        <span id={descriptionId} className="sr-only">{disabledReason}</span>
      ) : null}
    </>
  )
}

MenuItem.displayName = 'MenuItem'
