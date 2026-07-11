import type { SourceColumn, SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

export interface DynamoScanInput {
  TableName: string
  Limit: number
  ExclusiveStartKey?: Record<string, unknown>
}

export interface DynamoScanOutput {
  Items?: Record<string, unknown>[]
  LastEvaluatedKey?: Record<string, unknown>
}

export interface DynamoClient {
  scan?(input: DynamoScanInput): Promise<DynamoScanOutput>
  send?(input: DynamoScanInput): Promise<DynamoScanOutput>
}

export interface DynamoSyncAdapterOptions {
  client: DynamoClient
  table: string
  externalIdColumn?: string
  watermarkColumn?: string
  pageSize?: number
}

function sourceType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === 'string') ? 'ARRAY<STRING>' : 'array'
  }
  if (value instanceof Uint8Array) return 'binary'
  if (typeof value === 'object') return 'map'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'unknown'
}

function inferSchema(items: Record<string, unknown>[]): SourceColumn[] {
  const types = new Map<string, Set<string>>()

  for (const item of items) {
    for (const [name, value] of Object.entries(item)) {
      const observed = types.get(name) ?? new Set<string>()
      observed.add(sourceType(value))
      types.set(name, observed)
    }
  }

  return [...types].map(([name, observed]) => ({
    name,
    sourceType: [...observed].join(' | '),
    nullable: items.some((item) => !(name in item) || item[name] === null),
  }))
}

export class DynamoSyncAdapter implements SyncAdapter {
  readonly id: string
  private readonly pageSize: number

  constructor(private readonly options: DynamoSyncAdapterOptions) {
    this.id = `dynamo:${options.table}`
    this.pageSize = options.pageSize ?? 100
  }

  async describeSchema(): Promise<SourceSchema> {
    const page = await this.scan({ TableName: this.options.table, Limit: this.pageSize })
    return { columns: inferSchema(page.Items ?? []) }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const input: DynamoScanInput = {
      TableName: this.options.table,
      Limit: this.pageSize,
    }
    if (cursor !== undefined) input.ExclusiveStartKey = JSON.parse(cursor) as Record<string, unknown>

    const page = await this.scan(input)
    const nextCursor = page.LastEvaluatedKey === undefined
      ? null
      : JSON.stringify(page.LastEvaluatedKey)

    return {
      rows: page.Items ?? [],
      cursor: nextCursor,
      done: nextCursor === null,
    }
  }

  private scan(input: DynamoScanInput): Promise<DynamoScanOutput> {
    if (this.options.client.scan) return this.options.client.scan(input)
    if (this.options.client.send) return this.options.client.send(input)
    throw new TypeError('Dynamo adapter requires a scan or send client method')
  }
}
