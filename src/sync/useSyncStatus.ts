import { useCallback, useRef, useState } from 'react'
import type { SyncProgress, SyncRunResult } from './types'

export interface UseSyncStatusReturn {
  runId: number
  progress: SyncProgress | null
  result: SyncRunResult | null
  startRun(): number
  setProgress(runId: number, progress: SyncProgress | null): void
  setResult(runId: number, result: SyncRunResult | null): void
  reset(): void
}

export function useSyncStatus(): UseSyncStatusReturn {
  const currentRunId = useRef(0)
  const [runId, setRunId] = useState(0)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [result, setResult] = useState<SyncRunResult | null>(null)
  const startRun = useCallback(() => {
    const nextRunId = currentRunId.current + 1
    currentRunId.current = nextRunId
    setRunId(nextRunId)
    setProgress(null)
    setResult(null)
    return nextRunId
  }, [])
  const updateProgress = useCallback((updateRunId: number, nextProgress: SyncProgress | null) => {
    if (updateRunId !== currentRunId.current) return
    setProgress(nextProgress)
  }, [])
  const updateResult = useCallback((updateRunId: number, nextResult: SyncRunResult | null) => {
    if (updateRunId !== currentRunId.current) return
    setResult(nextResult)
  }, [])
  const reset = useCallback(() => {
    const nextRunId = currentRunId.current + 1
    currentRunId.current = nextRunId
    setRunId(nextRunId)
    setProgress(null)
    setResult(null)
  }, [])

  return {
    runId,
    progress,
    result,
    startRun,
    setProgress: updateProgress,
    setResult: updateResult,
    reset,
  }
}
