import { cn } from '../lib/utils'
import { useDataTable } from '../context'

interface FooterProps {
  children?: (info: { totalCount: number; filteredCount: number }) => React.ReactNode
  className?: string
}

export function Footer({ children, className }: FooterProps) {
  const { data, filteredData } = useDataTable()

  const defaultContent = (
    <span>{filteredData.length} of {data.length} records</span>
  )

  return (
    <div className={cn(
      "sticky bottom-0 z-10 px-4 py-2 text-right text-sm text-gray-400 bg-gray-900/60 backdrop-blur-sm",
      className,
    )}>
      {children ? children({ totalCount: data.length, filteredCount: filteredData.length }) : defaultContent}
    </div>
  )
}

Footer.displayName = 'Footer'
