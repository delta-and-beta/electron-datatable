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

    act(() => hook.current.setProgress(progress))
    expect(hook.current.progress).toEqual(progress)

    act(() => hook.current.setResult(result))
    expect(hook.current.result).toEqual(result)

    act(() => hook.current.reset())
    expect(hook.current.progress).toBeNull()
    expect(hook.current.result).toBeNull()
  })
})
