import type {
  SourceColumnType,
  SourceSchema,
  SyncAdapter,
  SyncCursor,
  SyncPage,
  SyncPushChange,
  SyncPushRecordResult,
} from '../types'

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

interface AirtablePushResponse {
  records: AirtableRecord[]
}

interface AirtableField {
  name: string
  type: string
  isComputed?: boolean
  options?: {
    symbol?: string
    precision?: number
  }
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
  'percent',
  'rating',
  'duration',
  'autoNumber',
])
const dateTypes = new Set(['date', 'dateTime', 'createdTime', 'lastModifiedTime'])
const tagsTypes = new Set(['multipleSelects', 'multipleRecordLinks', 'multipleLookupValues'])
const computedTypes = new Set([
  'formula',
  'rollup',
  'count',
  'autoNumber',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  'multipleLookupValues',
  'button',
])
const arrayFieldKinds = new Set(['multipleSelects', 'multipleRecordLinks'])
const typecastSensitiveFieldKinds = new Set([...arrayFieldKinds, 'singleSelect'])

function sourceType(type: string): SourceColumnType {
  if (stringTypes.has(type)) return 'string'
  if (type === 'currency') return 'currency'
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
  requestWithBody?(method: string, path: string, body: unknown): Promise<unknown>
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
  readonly capabilities: { snapshotConsistent: false; canPush: boolean }
  readonly pushBatchSize = 10
  private readonly pageSize: number
  private readonly interPageDelayMs: number
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly rateLimitDelayMs: number
  private lastRequestAt: number | undefined
  private schemaColumns: Map<string, SourceSchema['columns'][number]> | undefined

  constructor(private readonly options: AirtableSyncAdapterOptions) {
    this.id = `airtable:${options.baseId}/${options.table}`
    this.capabilities = {
      snapshotConsistent: false,
      canPush: options.client.requestWithBody !== undefined,
    }
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

    const schema: SourceSchema = {
      columns: [
        { name: 'airtable_id', sourceType: 'string', writable: false, fieldKind: 'recordId' },
        ...table.fields.map((field) => {
          const type = sourceType(field.type)
          return {
            name: field.name,
            sourceType: type,
            fieldKind: field.type,
            writable: !computedTypes.has(field.type)
              && !(field.type === 'barcode' && field.isComputed === true),
            ...(type === 'currency'
              ? {
                  metadata: {
                    symbol: field.options?.symbol,
                    precision: field.options?.precision,
                  },
                }
              : {}),
          }
        }),
      ],
    }
    this.schemaColumns = new Map(schema.columns.map((column) => [column.name, column]))
    return schema
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

  async push(changes: SyncPushChange[]): Promise<SyncPushRecordResult[]> {
    if (this.options.client.requestWithBody === undefined) {
      throw new TypeError(`Airtable adapter "${this.id}" requires client.requestWithBody for push`)
    }

    const results: SyncPushRecordResult[] = []
    for (let index = 0; index < changes.length; index += this.pushBatchSize) {
      const batch = changes.slice(index, index + this.pushBatchSize)
      const prepared = batch.map((change) => this.prepareChange(change))
      const valid = prepared.filter((item) => item.change !== undefined)
      const pushed = valid.length === 0
        ? []
        : await this.pushBatch(
            valid.map((item) => item.change!),
            !valid.some((item) => item.disableTypecast),
          )
      let pushedIndex = 0
      for (const item of prepared) {
        results.push(item.error ?? pushed[pushedIndex++])
      }
    }
    return results
  }

  private prepareChange(change: SyncPushChange): {
    change?: SyncPushChange
    disableTypecast: boolean
    error?: SyncPushRecordResult
  } {
    const fields: Record<string, unknown> = {}
    let disableTypecast = false
    for (const [name, value] of Object.entries(change.fields)) {
      if (name === 'airtable_id') continue
      const schemaColumn = this.schemaColumns?.get(name)
      if (schemaColumn?.writable === false) continue
      const fieldKind = schemaColumn?.fieldKind
      if (fieldKind !== undefined && typecastSensitiveFieldKinds.has(fieldKind)) {
        const valid = value === null
          || (arrayFieldKinds.has(fieldKind)
            ? Array.isArray(value) && value.every((item) => typeof item === 'string')
            : typeof value === 'string')
        if (!valid) {
          const expected = arrayFieldKinds.has(fieldKind) ? 'an array of strings' : 'a string'
          return {
            disableTypecast: false,
            error: {
              externalId: change.externalId,
              ok: false,
              error: `${name} must be ${expected} for Airtable ${fieldKind}`,
            },
          }
        }
        disableTypecast = true
      }
      fields[name] = value
    }
    return { change: { ...change, fields }, disableTypecast }
  }

  private async pushBatch(
    changes: SyncPushChange[],
    typecast = true,
  ): Promise<SyncPushRecordResult[]> {
    try {
      const response = await this.requestWithBody('PATCH', `${this.options.baseId}/${this.options.table}`, {
        records: changes.map(({ externalId, fields }) => {
          const pushFields = { ...fields }
          delete pushFields.airtable_id
          return { id: externalId, fields: pushFields }
        }),
        typecast,
      }) as AirtablePushResponse
      const returnedIds = new Set(response.records.map(({ id }) => id))
      return changes.map(({ externalId }) => returnedIds.has(externalId)
        ? { externalId, ok: true }
        : { externalId, ok: false, error: 'Airtable did not return the updated record' })
    } catch (error) {
      if (this.getErrorNumber(error, 'status') === 422 && changes.length > 1) {
        const results: SyncPushRecordResult[] = []
        for (const change of changes) results.push(...await this.pushBatch([change], typecast))
        return results
      }
      const message = this.getErrorMessage(error)
      return changes.map(({ externalId }) => ({ externalId, ok: false, error: message }))
    }
  }

  private async request(path: string, params?: Record<string, string>): Promise<unknown> {
    return this.requestWithRetry(() => params === undefined
      ? this.options.client.request(path)
      : this.options.client.request(path, params))
  }

  private async requestWithBody(method: string, path: string, body: unknown): Promise<unknown> {
    const requestWithBody = this.options.client.requestWithBody
    if (requestWithBody === undefined) {
      throw new TypeError(`Airtable adapter "${this.id}" requires client.requestWithBody for push`)
    }
    return this.requestWithRetry(() => requestWithBody.call(this.options.client, method, path, body))
  }

  private async requestWithRetry(operation: () => Promise<unknown>): Promise<unknown> {
    let retries = 0
    while (true) {
      await this.waitForRequestWindow()
      this.lastRequestAt = Date.now()
      try {
        return await operation()
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

  private getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const errorRecord = error as Record<string, unknown>
      for (const container of [errorRecord, errorRecord.response, errorRecord.body]) {
        if (typeof container === 'object' && container !== null) {
          const responseError = (container as Record<string, unknown>).error
          if (typeof responseError !== 'object' || responseError === null) continue
          const message = (responseError as Record<string, unknown>).message
          if (typeof message === 'string') return message
        }
      }
    }
    return error instanceof Error ? error.message : String(error)
  }

  private async waitForRequestWindow(): Promise<void> {
    if (this.lastRequestAt === undefined) return
    const remainingDelay = this.interPageDelayMs - (Date.now() - this.lastRequestAt)
    if (remainingDelay > 0) await sleep(remainingDelay)
  }
}
