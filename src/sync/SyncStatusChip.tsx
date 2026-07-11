import { LoaderCircle } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import type { SyncPhase, SyncProgress, SyncRunResult } from './types'

export interface SyncStatusChipProps {
  progress?: SyncProgress | null
  result?: SyncRunResult | null
  now?: Date
}

const phaseLabels: Record<SyncPhase, string> = {
  idle: 'Idle',
  schema: 'Reading schema',
  pulling: 'Pulling',
  writing: 'Writing',
  reconciling: 'Reconciling',
  done: 'Synced',
  error: 'Sync failed',
}

function relativeTime(timestamp: string, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(timestamp).getTime()) / 1000))
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 60) return 'just now'

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`

  const elapsedDays = Math.floor(elapsedHours / 24)
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`
}

function progressLabel(progress: SyncProgress): string {
  const amount = progress.total === undefined
    ? `${progress.current}`
    : `${progress.current}/${progress.total}`
  return `${phaseLabels[progress.phase]} ${amount}`
}

export function SyncStatusChip({ progress, result, now = new Date() }: SyncStatusChipProps) {
  const error = progress?.phase === 'error'
    ? progress.message ?? result?.errors[0] ?? 'Sync failed'
    : result?.errors[0]

  if (error) {
    return (
      <span title={error}>
        <StatusBadge variant="error">Sync failed</StatusBadge>
      </span>
    )
  }

  if (progress && progress.phase !== 'idle' && progress.phase !== 'done') {
    return (
      <StatusBadge variant="info" className="gap-1">
        <LoaderCircle className="h-3 w-3 animate-spin" aria-label="Sync in progress" />
        {progressLabel(progress)}
      </StatusBadge>
    )
  }

  if (result) {
    return (
      <StatusBadge variant="success">
        Synced {relativeTime(result.finishedAt, now)}
      </StatusBadge>
    )
  }

  return <StatusBadge variant="neutral">Not synced</StatusBadge>
}
