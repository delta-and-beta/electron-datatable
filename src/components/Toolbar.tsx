import { cn } from '../lib/utils'

interface ToolbarProps {
  children: React.ReactNode
  className?: string
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4 py-2 border-b border-gray-800",
      className,
    )}>
      {children}
    </div>
  )
}

Toolbar.displayName = 'Toolbar'
