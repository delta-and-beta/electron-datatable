import type {
  DeletionPolicy,
  SyncAdapter,
  SyncCursor,
  SyncEngineOptions,
  SyncProgressCallback,
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

  constructor(
    private readonly adapter: SyncAdapter,
    private readonly target: SyncTarget,
    private readonly options: SyncEngineOptions,
    private readonly onProgress?: SyncProgressCallback,
  ) {
    this.deletionPolicy = options.deletionPolicy ?? 'ignore'
  }

  dryRun(): Promise<SyncRunResult> {
    return this.run(false)
  }

  commit(): Promise<SyncRunResult> {
    return this.run(true)
  }

  private progress(phase: Parameters<SyncProgressCallback>[0]['phase'], current: number, message?: string): void {
    this.onProgress?.({ phase, current, message })
  }

  private async run(apply: boolean): Promise<SyncRunResult> {
    const result = newResult(this.options.watermark ?? null)
    let cursor = this.options.watermark
    const seenIds = new Set<string>()
    const plannedUpserts = new Map<string, PlannedUpsert>()

    try {
      this.progress('schema', 0)
      await this.adapter.describeSchema()

      const targetIds = new Set(await this.target.listIds?.() ?? [])
      let pageCount = 0
      let done = false
      this.progress('pulling', 0)

      while (!done && (this.options.pageLimit === undefined || pageCount < this.options.pageLimit)) {
        const page = await this.adapter.pull(cursor)
        pageCount += 1
        result.fetched += page.rows.length
        if (page.cursor !== null) cursor = page.cursor
        result.cursor = cursor ?? null

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

      if (apply) this.progress('writing', 0)
      for (const operation of plannedUpserts.values()) {
        if (apply) {
          try {
            await this.target.upsert(operation.externalId, operation.row)
          } catch (error) {
            result.errors.push(`${operation.externalId}: ${errorMessage(error)}`)
            continue
          }
        }

        if (operation.isUpdate) result.updated += 1
        else result.created += 1
        if (apply) this.progress('writing', result.created + result.updated)
      }

      this.progress('reconciling', 0)
      const completeSnapshot = this.options.watermark === undefined && done
      if (completeSnapshot && this.deletionPolicy !== 'ignore') {
        const missingIds = [...targetIds].filter((id) => !seenIds.has(id))
        if (!apply || this.deletionPolicy === 'markMissing') {
          result.deleted = missingIds.length
        } else if (this.target.delete) {
          for (const externalId of missingIds) {
            try {
              await this.target.delete(externalId)
              result.deleted += 1
            } catch (error) {
              result.errors.push(`${externalId}: ${errorMessage(error)}`)
            }
          }
        }
      }

      this.progress('done', result.fetched)
    } catch (error) {
      result.errors.push(errorMessage(error))
      this.progress('error', result.fetched, errorMessage(error))
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

  return {
    start() {
      if (timer !== undefined) return
      timer = setInterval(() => void fn(), intervalMs)
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
