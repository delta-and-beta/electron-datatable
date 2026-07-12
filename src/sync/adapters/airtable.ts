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
  id?: string
  name: string
  description?: string
  type: string
  isComputed?: boolean
  options?: Record<string, unknown> & {
    symbol?: string
    precision?: number
    choices?: Array<Record<string, unknown> & { name: string }>
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
const selectFieldKinds = new Set(['singleSelect', 'multipleSelects'])
const collaboratorFieldKinds = new Set(['singleCollaborator', 'multipleCollaborators'])
const knownWritableFieldKinds = new Set([
  'singleLineText',
  'multilineText',
  'richText',
  'email',
  'url',
  'phoneNumber',
  'singleSelect',
  'multipleSelects',
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
  'date',
  'dateTime',
  'checkbox',
  'barcode',
  'multipleAttachments',
  ...collaboratorFieldKinds,
])
const safeTypecastFieldKinds = new Set([
  'singleLineText',
  'multilineText',
  'richText',
  'email',
  'url',
  'phoneNumber',
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
  'date',
  'dateTime',
])

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
  private schema: SourceSchema | undefined
  private schemaPromise: Promise<SourceSchema> | undefined

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
    return this.ensureSchema()
  }

  private async ensureSchema(): Promise<SourceSchema> {
    if (this.schema !== undefined) return this.schema
    if (this.schemaPromise === undefined) {
      this.schemaPromise = this.loadSchema()
        .then((schema) => {
          this.schema = schema
          this.schemaColumns = new Map(schema.columns.map((column) => [column.name, column]))
          return schema
        })
        .catch((error: unknown) => {
          this.schemaPromise = undefined
          throw error
        })
    }
    return this.schemaPromise
  }

  private async loadSchema(): Promise<SourceSchema> {
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
          const metadata = {
            ...(field.id === undefined ? {} : { fieldId: field.id }),
            ...(field.description === undefined ? {} : { description: field.description }),
            ...(field.options === undefined ? {} : { airtableOptions: field.options }),
            ...(type === 'currency'
              ? {
                  symbol: field.options?.symbol,
                  precision: field.options?.precision,
                }
              : {}),
            ...(field.options?.choices === undefined
              ? {}
              : { options: field.options.choices.map(({ name }) => name) }),
          }
          return {
            name: field.name,
            sourceType: type,
            fieldKind: field.type,
            writable: knownWritableFieldKinds.has(field.type)
              && !computedTypes.has(field.type)
              && field.type !== 'multipleRecordLinks'
              && !(field.type === 'barcode' && field.isComputed === true),
            ...(Object.keys(metadata).length === 0 ? {} : { metadata }),
          }
        }),
      ],
    }
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
    if (changes.length === 0) return []

    try {
      await this.ensureSchema()
    } catch (error) {
      const message = `Airtable schema load failed: ${this.getErrorMessage(error)}`
      return changes.map(({ externalId }) => ({ externalId, ok: false, error: message }))
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
            prepared.every((item) => item.allowTypecast),
          )
      let pushedIndex = 0
      for (const item of prepared) {
        results.push(item.result ?? pushed[pushedIndex++])
      }
    }
    return results
  }

  private prepareChange(change: SyncPushChange): {
    change?: SyncPushChange
    allowTypecast: boolean
    result?: SyncPushRecordResult
  } {
    const fields: Record<string, unknown> = {}
    let allowTypecast = true
    for (const [name, value] of Object.entries(change.fields)) {
      if (name === 'airtable_id') continue
      const schemaColumn = this.schemaColumns?.get(name)
      const fieldKind = schemaColumn?.fieldKind
      if (schemaColumn?.writable !== true || fieldKind === undefined) {
        allowTypecast = false
        continue
      }
      if (selectFieldKinds.has(fieldKind)) {
        allowTypecast = false
        const values = fieldKind === 'multipleSelects' ? value : [value]
        const validShape = value === null || (
          Array.isArray(values)
          && values.every((item) => typeof item === 'string')
        )
        if (!validShape) return this.invalidShape(change, name, fieldKind)

        const options = new Set(schemaColumn.metadata?.options ?? [])
        const hasNewOption = value !== null
          && (values as unknown[]).some((item) => !options.has(String(item)))
        if (hasNewOption) {
          return {
            allowTypecast: false,
            result: {
              externalId: change.externalId,
              ok: false,
              error: `value is not an existing option for ${name}`,
            },
          }
        }
      } else if (collaboratorFieldKinds.has(fieldKind)) {
        allowTypecast = false
        const isCollaborator = (item: unknown) => (
          typeof item === 'object'
          && item !== null
          && typeof (item as Record<string, unknown>).id === 'string'
        )
        const valid = value === null || (fieldKind === 'multipleCollaborators'
          ? Array.isArray(value) && value.every(isCollaborator)
          : isCollaborator(value))
        if (!valid) return this.invalidShape(change, name, fieldKind)
      } else if (!safeTypecastFieldKinds.has(fieldKind)) {
        allowTypecast = false
      }
      fields[name] = value
    }
    if (Object.keys(fields).length === 0) {
      return {
        allowTypecast: false,
        result: { externalId: change.externalId, ok: true },
      }
    }
    return { change: { ...change, fields }, allowTypecast }
  }

  private invalidShape(
    change: SyncPushChange,
    name: string,
    fieldKind: string,
  ): { allowTypecast: false; result: SyncPushRecordResult } {
    return {
      allowTypecast: false,
      result: {
        externalId: change.externalId,
        ok: false,
        error: `${name} has an invalid value shape for Airtable ${fieldKind}`,
      },
    }
  }

  private async pushBatch(
    changes: SyncPushChange[],
    typecast = false,
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
