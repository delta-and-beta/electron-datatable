import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SyncProgress, SyncRunResult } from './types'

export interface UseSyncStatusReturn {
  progress: SyncProgress | null
  result: SyncRunResult | null
  setProgress: Dispatch<SetStateAction<SyncProgress | null>>
  setResult: Dispatch<SetStateAction<SyncRunResult | null>>
  reset(): void
}

export function useSyncStatus(): UseSyncStatusReturn {
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [result, setResult] = useState<SyncRunResult | null>(null)
  const reset = useCallback(() => {
    setProgress(null)
    setResult(null)
  }, [])

  return { progress, result, setProgress, setResult, reset }
}
