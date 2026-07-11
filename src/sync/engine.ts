import type {
  DeletionPolicy,
  SyncAdapter,
  SyncCursor,
  SyncEngineOptions,
  SyncProgressCallback,
  SyncPushChange,
  SyncPushRecordResult,
  SyncRunResult,
  SyncTarget,
} from './types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function newResult(cursor: SyncCursor | null): SyncRunResult {
  const startedAt = new Date().toISOString()
  return {
    fetched: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
    cursor,
  }
}

interface PlannedUpsert {
  externalId: string
  row: Record<string, unknown>
  isUpdate: boolean
}

export class SyncEngine {
  private readonly deletionPolicy: DeletionPolicy
  private readonly transactional: boolean

  constructor(
    private readonly adapter: SyncAdapter,
    private readonly target: SyncTarget,
    private readonly options: SyncEngineOptions,
    private readonly onProgress?: SyncProgressCallback,
  ) {
    this.deletionPolicy = options.deletionPolicy ?? 'ignore'
    if (this.deletionPolicy === 'delete' && adapter.capabilities?.snapshotConsistent !== true) {
      throw new TypeError(
        "deletionPolicy 'delete' requires a snapshot-consistent adapter; use 'markMissing' for this source",
      )
    }
    const transactionHooks = [target.begin, target.commitTx, target.rollback]
    const configuredHooks = transactionHooks.filter((hook) => hook !== undefined).length
    if (configuredHooks > 0 && configuredHooks < transactionHooks.length) {
      throw new TypeError('SyncTarget transactions require begin, commitTx, and rollback together')
    }
    this.transactional = configuredHooks === transactionHooks.length
  }

  dryRun(): Promise<SyncRunResult> {
    return this.run(false)
  }

  commit(): Promise<SyncRunResult> {
    return this.run(true)
  }

  async push(changes: SyncPushChange[]): Promise<SyncPushRecordResult[]> {
    if (this.adapter.capabilities?.canPush !== true || this.adapter.push === undefined) {
      throw new TypeError(`Sync adapter "${this.adapter.id}" is not configured for push`)
    }

    const batchSize = Math.max(1, Math.floor(this.adapter.pushBatchSize ?? 10))
    const results: SyncPushRecordResult[] = []
    for (let index = 0; index < changes.length; index += batchSize) {
      const batch = changes.slice(index, index + batchSize)
      try {
        results.push(...await this.adapter.push(batch))
      } catch (error) {
        const message = errorMessage(error)
        results.push(...batch.map(({ externalId }) => ({ externalId, ok: false, error: message })))
      }
    }
    return results
  }

  private progress(phase: Parameters<SyncProgressCallback>[0]['phase'], current: number, message?: string): void {
    this.onProgress?.({ phase, current, message })
  }

  private async run(apply: boolean): Promise<SyncRunResult> {
    const result = newResult(this.options.watermark ?? null)
    let cursor = this.options.watermark
    const seenIds = new Set<string>()
    const plannedUpserts = new Map<string, PlannedUpsert>()
    let transactionStarted = false

    try {
      this.progress('schema', 0)
      const schema = await this.adapter.describeSchema()
      if (schema.warning) result.errors.push(schema.warning)

      const targetIds = new Set(await this.target.listIds?.() ?? [])
      let pageCount = 0
      let done = false
      this.progress('pulling', 0)

      while (!done && (this.options.pageLimit === undefined || pageCount < this.options.pageLimit)) {
        const page = await this.adapter.pull(cursor)
        pageCount += 1
        result.fetched += page.rows.length
        cursor = page.cursor ?? undefined
        result.cursor = page.cursor

        for (const row of page.rows) {
          const rawExternalId = row[this.options.externalIdField]
          if (typeof rawExternalId !== 'string' && typeof rawExternalId !== 'number') {
            result.errors.push(`Row is missing a valid ${this.options.externalIdField} external id`)
            continue
          }

          const externalId = String(rawExternalId)
          seenIds.add(externalId)
          plannedUpserts.set(externalId, { externalId, row, isUpdate: targetIds.has(externalId) })
        }

        done = page.done
        this.progress('pulling', result.fetched)
      }

      if (apply) {
        this.progress('writing', 0)
        if (this.transactional) {
          await this.target.begin!()
          transactionStarted = true
        }
      }
      let stoppedOnError = false
      for (const operation of plannedUpserts.values()) {
        if (apply) {
          try {
            await this.target.upsert(operation.externalId, operation.row)
          } catch (error) {
            const message = `${operation.externalId}: ${errorMessage(error)}`
            if (this.transactional) throw new Error(message)
            result.errors.push(message)
            if (this.options.stopOnError) {
              stoppedOnError = true
              break
            }
            continue
          }
        }

        if (operation.isUpdate) result.updated += 1
        else result.created += 1
        if (apply) this.progress('writing', result.created + result.updated)
      }

      this.progress('reconciling', 0)
      const completeSnapshot = this.options.watermark === undefined && done
      if (!stoppedOnError && completeSnapshot && this.deletionPolicy !== 'ignore') {
        const missingIds = [...targetIds].filter((id) => !seenIds.has(id))
        if (!apply || this.deletionPolicy === 'markMissing') {
          result.deleted = missingIds.length
        } else if (this.target.delete) {
          for (const externalId of missingIds) {
            try {
              await this.target.delete(externalId)
              result.deleted += 1
            } catch (error) {
              const message = `${externalId}: ${errorMessage(error)}`
              if (this.transactional) throw new Error(message)
              result.errors.push(message)
              if (this.options.stopOnError) break
            }
          }
        }
      }

      if (apply && this.transactional) {
        await this.target.commitTx!()
        transactionStarted = false
      }

      this.progress('done', result.fetched)
    } catch (error) {
      const message = errorMessage(error)
      if (transactionStarted) {
        try {
          await this.target.rollback!()
        } catch (rollbackError) {
          result.errors.push(`Rollback failed: ${errorMessage(rollbackError)}`)
        }
        result.created = 0
        result.updated = 0
        result.deleted = 0
      }
      result.errors.unshift(message)
      this.progress('error', result.fetched, message)
    }

    result.finishedAt = new Date().toISOString()
    return result
  }
}

export interface PollingHandle {
  start(): void
  stop(): void
  isRunning(): boolean
}

export function createPollingHandle(fn: () => void | Promise<void>, intervalMs: number): PollingHandle {
  let timer: ReturnType<typeof setInterval> | undefined
  let pending = false

  return {
    start() {
      if (timer !== undefined) return
      timer = setInterval(() => {
        if (pending) return
        pending = true
        try {
          const outcome = fn()
          if (outcome instanceof Promise) {
            void outcome.then(
              () => { pending = false },
              () => { pending = false },
            )
          } else {
            pending = false
          }
        } catch {
          pending = false
        }
      }, intervalMs)
    },
    stop() {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    },
    isRunning() {
      return timer !== undefined
    },
  }
}
