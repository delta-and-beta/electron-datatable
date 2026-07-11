import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPollingHandle, SyncEngine } from './engine'
import type { SyncAdapter, SyncPage, SyncTarget } from './types'

function createMockAdapter(overrides?: Partial<SyncAdapter>): SyncAdapter {
  return {
    id: 'mock',
    capabilities: { snapshotConsistent: true },
    describeSchema: vi.fn().mockResolvedValue({ columns: [] }),
    pull: vi.fn().mockResolvedValue({ rows: [], cursor: null, done: true }),
    ...overrides,
  }
}

function createMockTarget(overrides?: Partial<SyncTarget>): SyncTarget {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    listIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('SyncEngine', () => {
  it('rejects destructive reconciliation for a non-snapshot source', () => {
    const adapter = createMockAdapter({ capabilities: { snapshotConsistent: false } })

    expect(() => new SyncEngine(adapter, createMockTarget(), {
      externalIdField: 'id',
      deletionPolicy: 'delete',
    })).toThrow(
      "deletionPolicy 'delete' requires a snapshot-consistent adapter; use 'markMissing' for this source",
    )
  })

  it('allows destructive reconciliation for a snapshot-consistent source', () => {
    const adapter = createMockAdapter({ capabilities: { snapshotConsistent: true } })

    expect(() => new SyncEngine(adapter, createMockTarget(), {
      externalIdField: 'id',
      deletionPolicy: 'delete',
    })).not.toThrow()
  })

  it('dryRun pulls all pages and classifies rows without target writes', async () => {
    const pages = new Map<string | undefined, SyncPage>([
      [undefined, { rows: [{ id: 'existing' }, { id: 'new' }], cursor: 'page-2', done: false }],
      ['page-2', { rows: [], cursor: 'page-2', done: true }],
    ])
    const adapter = createMockAdapter({
      pull: vi.fn((cursor?: string) => Promise.resolve(pages.get(cursor)!)),
    })
    const target = createMockTarget({
      listIds: vi.fn().mockResolvedValue(['existing']),
    })

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id' }).dryRun()

    expect(result).toEqual(expect.objectContaining({
      fetched: 2,
      created: 1,
      updated: 1,
      deleted: 0,
      errors: [],
      cursor: 'page-2',
    }))
    expect(target.upsert).not.toHaveBeenCalled()
    expect(target.delete).not.toHaveBeenCalled()
    expect(adapter.pull).toHaveBeenNthCalledWith(1, undefined)
    expect(adapter.pull).toHaveBeenNthCalledWith(2, 'page-2')
  })

  it('commit applies creates and updates keyed by externalIdField', async () => {
    const adapter = createMockAdapter({
      pull: vi.fn()
        .mockResolvedValueOnce({ rows: [{ source_id: 'a', value: 1 }, { source_id: 'b', value: 2 }], cursor: '2', done: false })
        .mockResolvedValueOnce({ rows: [], cursor: '2', done: true }),
    })
    const target = createMockTarget({ listIds: vi.fn().mockResolvedValue(['a']) })

    const result = await new SyncEngine(adapter, target, { externalIdField: 'source_id' }).commit()

    expect(target.upsert).toHaveBeenNthCalledWith(1, 'a', { source_id: 'a', value: 1 })
    expect(target.upsert).toHaveBeenNthCalledWith(2, 'b', { source_id: 'b', value: 2 })
    expect(result).toEqual(expect.objectContaining({ fetched: 2, created: 1, updated: 1, errors: [] }))
  })

  it('accumulates per-row errors and continues the run', async () => {
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({
        rows: [{ id: 'bad' }, { id: null }, { id: 'good' }],
        cursor: '3',
        done: true,
      }),
    })
    const target = createMockTarget({
      upsert: vi.fn().mockImplementation((id: string) => id === 'bad'
        ? Promise.reject(new Error('write failed'))
        : Promise.resolve()),
    })

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id' }).commit()

    expect(target.upsert).toHaveBeenCalledTimes(2)
    expect(target.upsert).toHaveBeenLastCalledWith('good', { id: 'good' })
    expect(result.fetched).toBe(3)
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors).toEqual(expect.arrayContaining([
      'bad: write failed',
      'Row is missing a valid id external id',
    ]))
  })

  it('wraps all writes in a target transaction and rolls back the failed run', async () => {
    const calls: string[] = []
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({
        rows: [{ id: 'first' }, { id: 'bad' }, { id: 'never' }],
        cursor: null,
        done: true,
      }),
    })
    const target = createMockTarget({
      begin: vi.fn(() => { calls.push('begin') }),
      upsert: vi.fn(async (id: string) => {
        calls.push(`upsert:${id}`)
        if (id === 'bad') throw new Error('write failed')
      }),
      commitTx: vi.fn(() => { calls.push('commit') }),
      rollback: vi.fn(() => { calls.push('rollback') }),
    })

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id' }).commit()

    expect(calls).toEqual(['begin', 'upsert:first', 'upsert:bad', 'rollback'])
    expect(result).toEqual(expect.objectContaining({
      created: 0,
      updated: 0,
      deleted: 0,
      errors: ['bad: write failed'],
    }))
  })

  it('stops best-effort writes after the first error when stopOnError is enabled', async () => {
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({
        rows: [{ id: 'bad' }, { id: 'never' }],
        cursor: null,
        done: true,
      }),
    })
    const target = createMockTarget({
      upsert: vi.fn(async (id: string) => {
        if (id === 'bad') throw new Error('write failed')
      }),
    })

    const result = await new SyncEngine(adapter, target, {
      externalIdField: 'id',
      stopOnError: true,
    }).commit()

    expect(target.upsert).toHaveBeenCalledOnce()
    expect(result.errors).toEqual(['bad: write failed'])
  })

  it.each([
    ['ignore', 0, 0],
    ['markMissing', 1, 0],
    ['delete', 1, 1],
  ] as const)('applies the %s deletion policy', async (deletionPolicy, deleted, deleteCalls) => {
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({ rows: [{ id: 'kept' }], cursor: 'done', done: true }),
    })
    const target = createMockTarget({ listIds: vi.fn().mockResolvedValue(['kept', 'missing']) })

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id', deletionPolicy }).commit()

    expect(result.deleted).toBe(deleted)
    expect(target.delete).toHaveBeenCalledTimes(deleteCalls)
    if (deleteCalls) expect(target.delete).toHaveBeenCalledWith('missing')
  })

  it.each([
    [{ watermark: 'resume-from-here' }, 'incremental'],
    [{ pageLimit: 1 }, 'page-limited'],
  ] as const)('does not reconcile deletions for an incomplete %s pull', async (partialOptions) => {
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({
        rows: [{ id: 'seen' }],
        cursor: 'next',
        done: 'watermark' in partialOptions,
      }),
    })
    const target = createMockTarget({ listIds: vi.fn().mockResolvedValue(['older', 'seen', 'later']) })

    const result = await new SyncEngine(adapter, target, {
      externalIdField: 'id',
      deletionPolicy: 'delete',
      ...partialOptions,
    }).commit()

    expect(result.deleted).toBe(0)
    expect(target.delete).not.toHaveBeenCalled()
  })

  it('deduplicates source rows by external id using the last row', async () => {
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({
        rows: [{ id: 'duplicate', value: 1 }, { id: 'duplicate', value: 2 }],
        cursor: 'done',
        done: true,
      }),
    })
    const target = createMockTarget()

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id' }).commit()

    expect(target.upsert).toHaveBeenCalledOnce()
    expect(target.upsert).toHaveBeenCalledWith('duplicate', { id: 'duplicate', value: 2 })
    expect(result).toEqual(expect.objectContaining({ fetched: 2, created: 1, updated: 0 }))
  })

  it('uses and returns the opaque cursor and reports progress phases', async () => {
    const onProgress = vi.fn()
    const adapter = createMockAdapter({
      pull: vi.fn().mockResolvedValue({ rows: [], cursor: 'next-watermark', done: true }),
    })

    const result = await new SyncEngine(
      adapter,
      createMockTarget(),
      { externalIdField: 'id', watermark: 'saved-watermark' },
      onProgress,
    ).dryRun()

    expect(adapter.pull).toHaveBeenCalledWith('saved-watermark')
    expect(result.cursor).toBe('next-watermark')
    expect(onProgress.mock.calls.map(([progress]) => progress.phase)).toEqual([
      'schema',
      'pulling',
      'pulling',
      'reconciling',
      'done',
    ])
    expect(onProgress.mock.calls.map(([progress]) => progress.current)).toEqual([0, 0, 0, 0, 0])
  })

  it('persists an exact terminal null cursor so the next run starts fresh', async () => {
    const firstAdapter = createMockAdapter({
      pull: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'first' }], cursor: 'dynamo-page-2', done: false })
        .mockResolvedValueOnce({ rows: [{ id: 'second' }], cursor: null, done: true }),
    })

    const firstResult = await new SyncEngine(
      firstAdapter,
      createMockTarget(),
      { externalIdField: 'id' },
    ).commit()

    const nextAdapter = createMockAdapter()
    await new SyncEngine(
      nextAdapter,
      createMockTarget(),
      { externalIdField: 'id', watermark: firstResult.cursor ?? undefined },
    ).dryRun()

    expect(firstResult.cursor).toBeNull()
    expect(nextAdapter.pull).toHaveBeenCalledWith(undefined)
  })

  it('aborts page pulling and returns the adapter error', async () => {
    const adapter = createMockAdapter({
      pull: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'not-written' }], cursor: 'page-2', done: false })
        .mockRejectedValueOnce(new Error('source unavailable')),
    })
    const target = createMockTarget()

    const result = await new SyncEngine(adapter, target, { externalIdField: 'id' }).commit()

    expect(result.errors).toEqual(['source unavailable'])
    expect(result.fetched).toBe(1)
    expect(target.upsert).not.toHaveBeenCalled()
  })
})

describe('createPollingHandle', () => {
  it('starts and stops one idempotent interval', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const handle = createPollingHandle(fn, 100)

    handle.start()
    handle.start()
    expect(handle.isRunning()).toBe(true)
    vi.advanceTimersByTime(250)
    expect(fn).toHaveBeenCalledTimes(2)

    handle.stop()
    expect(handle.isRunning()).toBe(false)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('skips ticks while the previous callback promise is pending', async () => {
    vi.useFakeTimers()
    let resolve: (() => void) | undefined
    const fn = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    const handle = createPollingHandle(fn, 100)

    handle.start()
    await vi.advanceTimersByTimeAsync(350)
    expect(fn).toHaveBeenCalledOnce()

    resolve?.()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    handle.stop()
  })
})
