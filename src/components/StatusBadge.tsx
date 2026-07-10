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
  success: 'bg-dt-positive/10 text-dt-positive',
  warning: 'bg-amber-500/10 text-amber-500',
  error: 'bg-dt-negative/10 text-dt-negative',
  info: 'bg-dt-primary/10 text-dt-primary',
  neutral: 'bg-dt-muted/10 text-dt-muted',
  purple: 'bg-purple-500/10 text-purple-500',
  cyan: 'bg-cyan-500/10 text-cyan-500',
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
