import type { SourceColumnType, SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

const RETRY_DELAY_MS = 1000
const RATE_LIMIT_DELAY_MS = 30_000

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

interface AirtableListResponse {
  records: AirtableRecord[]
  offset?: string
}

interface AirtableField {
  name: string
  type: string
}

interface AirtableTable {
  id: string
  name: string
  fields: AirtableField[]
}

interface AirtableMetaResponse {
  tables: AirtableTable[]
}

const stringTypes = new Set([
  'singleLineText',
  'multilineText',
  'richText',
  'email',
  'url',
  'phoneNumber',
  'singleSelect',
])
const numberTypes = new Set([
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
  'autoNumber',
])
const dateTypes = new Set(['date', 'dateTime', 'createdTime', 'lastModifiedTime'])
const tagsTypes = new Set(['multipleSelects', 'multipleRecordLinks', 'multipleLookupValues'])

function sourceType(type: string): SourceColumnType {
  if (stringTypes.has(type)) return 'string'
  if (numberTypes.has(type)) return 'number'
  if (dateTypes.has(type)) return 'date'
  if (type === 'checkbox') return 'boolean'
  if (tagsTypes.has(type)) return 'tags'
  return 'custom'
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export interface AirtableClient {
  /**
   * Consumers should throw errors with a numeric `status` field so the adapter
   * can distinguish rate limits, transient server failures, and client errors.
   * A numeric `retryAfterMs` field may also provide an explicit retry delay.
   */
  request(path: string, params?: Record<string, string>): Promise<unknown>
}

export interface AirtableSyncAdapterOptions {
  client: AirtableClient
  baseId: string
  table: string
  view?: string
  fields?: string[]
  pageSize?: number
  interPageDelayMs?: number
  maxRetries?: number
  retryDelayMs?: number
  rateLimitDelayMs?: number
}

export class AirtableSyncAdapter implements SyncAdapter {
  readonly id: string
  readonly capabilities = { snapshotConsistent: false } as const
  private readonly pageSize: number
  private readonly interPageDelayMs: number
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly rateLimitDelayMs: number
  private lastRequestAt: number | undefined

  constructor(private readonly options: AirtableSyncAdapterOptions) {
    this.id = `airtable:${options.baseId}/${options.table}`
    this.pageSize = Math.min(options.pageSize ?? 100, 100)
    this.interPageDelayMs = options.interPageDelayMs ?? 210
    this.maxRetries = Math.max(options.maxRetries ?? 1, 0)
    this.retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? RATE_LIMIT_DELAY_MS
  }

  async describeSchema(): Promise<SourceSchema> {
    const response = await this.request(`meta/bases/${this.options.baseId}/tables`) as AirtableMetaResponse
    const table = response.tables.find(({ id, name }) => id === this.options.table || name === this.options.table)
    if (table === undefined) {
      throw new Error(`Airtable table "${this.options.table}" was not found`)
    }

    return {
      columns: [
        { name: 'airtable_id', sourceType: 'string' },
        ...table.fields.map((field) => ({
          name: field.name,
          sourceType: sourceType(field.type),
        })),
      ],
    }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const params: Record<string, string> = { pageSize: String(this.pageSize) }
    if (cursor !== undefined) params.offset = cursor
    if (this.options.view !== undefined) params.view = this.options.view
    if (this.options.fields !== undefined && this.options.fields.length > 0) {
      this.options.fields.forEach((field, index) => {
        params[index === 0 ? 'fields[]' : `fields[${index}]`] = field
      })
    }

    const response = await this.request(
      `${this.options.baseId}/${this.options.table}`,
      params,
    ) as AirtableListResponse
    const nextCursor = response.offset ?? null

    return {
      rows: response.records.map((record) => ({ airtable_id: record.id, ...record.fields })),
      cursor: nextCursor,
      done: nextCursor === null,
    }
  }

  private async request(path: string, params?: Record<string, string>): Promise<unknown> {
    let retries = 0
    while (true) {
      await this.waitForRequestWindow()
      this.lastRequestAt = Date.now()
      try {
        return params === undefined
          ? await this.options.client.request(path)
          : await this.options.client.request(path, params)
      } catch (error) {
        if (retries >= this.maxRetries) throw error
        const retryDelayMs = this.getRetryDelay(error)
        if (retryDelayMs === undefined) throw error
        retries += 1
        await sleep(retryDelayMs)
      }
    }
  }

  private getRetryDelay(error: unknown): number | undefined {
    const status = this.getErrorNumber(error, 'status')
    const retryAfterMs = this.getErrorNumber(error, 'retryAfterMs')
    if (status === 429) return retryAfterMs ?? this.rateLimitDelayMs
    if (status !== undefined && status >= 500 && status < 600) return retryAfterMs ?? this.retryDelayMs
    if (status === undefined) return retryAfterMs ?? this.retryDelayMs
    return undefined
  }

  private getErrorNumber(error: unknown, field: 'status' | 'retryAfterMs'): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined
    const value = (error as Record<string, unknown>)[field]
    return typeof value === 'number' ? value : undefined
  }

  private async waitForRequestWindow(): Promise<void> {
    if (this.lastRequestAt === undefined) return
    const remainingDelay = this.interPageDelayMs - (Date.now() - this.lastRequestAt)
    if (remainingDelay > 0) await sleep(remainingDelay)
  }
}
