import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'cyan'

interface StatusBadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-dt-badge-success/10 text-dt-badge-success',
  warning: 'bg-dt-badge-warning/10 text-dt-badge-warning',
  error: 'bg-dt-badge-error/10 text-dt-badge-error',
  info: 'bg-dt-badge-info/10 text-dt-badge-info',
  neutral: 'bg-dt-badge-neutral/10 text-dt-badge-neutral',
  purple: 'bg-dt-badge-purple/10 text-dt-badge-purple',
  cyan: 'bg-dt-badge-cyan/10 text-dt-badge-cyan',
}

export function StatusBadge({
  variant = 'neutral',
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
