import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { useDataTable } from '../context'

export type FooterKpi = {
  label: string
  value: ReactNode
  accent?: 'default' | 'positive' | 'negative' | 'info'
}

interface FooterProps {
  children?: (info: { totalCount: number; filteredCount: number }) => React.ReactNode
  className?: string
  kpis?: FooterKpi[]
}

const accentClasses: Record<NonNullable<FooterKpi['accent']>, string> = {
  default: 'text-dt-text',
  positive: 'text-dt-positive',
  negative: 'text-dt-negative',
  info: 'text-dt-primary',
}

export function Footer({ children, className, kpis }: FooterProps) {
  const { data, filteredData } = useDataTable()

  return (
    <div className={cn(
      'sticky bottom-0 z-10 flex items-center justify-between gap-4 px-4 py-2 text-sm text-dt-muted bg-dt-bg-secondary/60 backdrop-blur-sm',
      className,
    )}>
      {children
        ? children({ totalCount: data.length, filteredCount: filteredData.length })
        : (
            <>
              <span className="shrink-0">{filteredData.length} of {data.length} records</span>
              {kpis && kpis.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {kpis.map((kpi, index) => (
                    <span
                      className="inline-flex items-baseline gap-1.5 whitespace-nowrap rounded border border-dt-border bg-dt-bg px-2 py-0.5"
                      key={`${kpi.label}-${index}`}
                    >
                      <span>
                        <span>{kpi.label}</span>
                        <span aria-hidden="true">:</span>
                      </span>
                      <span className={cn('font-medium tabular-nums', accentClasses[kpi.accent ?? 'default'])}>
                        {kpi.value}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
    </div>
  )
}

Footer.displayName = 'Footer'
