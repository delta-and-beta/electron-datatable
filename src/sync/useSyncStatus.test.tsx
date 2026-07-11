import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSyncStatus } from './useSyncStatus'
import type { SyncProgress, SyncRunResult } from './types'

const progress: SyncProgress = {
  phase: 'pulling',
  current: 20,
  total: 100,
  message: 'Reading transactions',
}

const result: SyncRunResult = {
  fetched: 100,
  created: 80,
  updated: 20,
  deleted: 0,
  errors: [],
  startedAt: '2026-07-11T09:00:00.000Z',
  finishedAt: '2026-07-11T09:01:00.000Z',
  cursor: '100',
}

describe('useSyncStatus', () => {
  it('holds consumer-fed progress and run result state for the session', () => {
    const { result: hook } = renderHook(() => useSyncStatus())

    expect(hook.current.progress).toBeNull()
    expect(hook.current.result).toBeNull()

    let runId = 0
    act(() => { runId = hook.current.startRun() })
    act(() => hook.current.setProgress(runId, progress))
    expect(hook.current.progress).toEqual(progress)

    act(() => hook.current.setResult(runId, result))
    expect(hook.current.result).toEqual(result)

    act(() => hook.current.reset())
    expect(hook.current.progress).toBeNull()
    expect(hook.current.result).toBeNull()
  })

  it('clears prior state and ignores late setters from an older run', () => {
    const { result: hook } = renderHook(() => useSyncStatus())
    let oldRunId = 0
    let currentRunId = 0

    act(() => { oldRunId = hook.current.startRun() })
    act(() => hook.current.setResult(oldRunId, { ...result, errors: ['old failure'] }))
    act(() => { currentRunId = hook.current.startRun() })
    act(() => hook.current.setProgress(currentRunId, progress))
    act(() => hook.current.setProgress(oldRunId, { phase: 'error', current: 0, message: 'late error' }))
    act(() => hook.current.setResult(oldRunId, { ...result, errors: ['late failure'] }))

    expect(hook.current.runId).toBe(currentRunId)
    expect(hook.current.progress).toEqual(progress)
    expect(hook.current.result).toBeNull()
  })
})
