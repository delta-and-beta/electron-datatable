import { cn } from '../../lib/utils'

const config = {
  high:   { bg: 'bg-dt-positive/10', text: 'text-dt-positive', label: 'High' },
  medium: { bg: 'bg-yellow-400/10',  text: 'text-yellow-400',  label: 'Medium' },
  low:    { bg: 'bg-dt-negative/10', text: 'text-dt-negative', label: 'Low' },
} as const

export function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const c = config[confidence]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', c.bg, c.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', confidence === 'high' ? 'bg-dt-positive' : confidence === 'medium' ? 'bg-yellow-400' : 'bg-dt-negative')} />
      {c.label}
    </span>
  )
}
