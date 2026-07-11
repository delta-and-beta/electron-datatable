import type { SourceColumn, SourceColumnType, SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

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
  scan(input: DynamoScanInput): Promise<DynamoScanOutput>
}

export interface DynamoDocumentClient<Command> {
  send(command: Command): Promise<DynamoScanOutput>
}

export interface DynamoScanCommandConstructor<Command> {
  new(input: DynamoScanInput): Command
}

/**
 * Adapts an AWS document client without importing an AWS driver.
 *
 * @example
 * ```ts
 * import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
 * const client = fromDocumentClient(DynamoDBDocumentClient.from(dynamo), ScanCommand)
 * ```
 */
export function fromDocumentClient<Command>(
  documentClient: DynamoDocumentClient<Command>,
  ScanCommandCtor: DynamoScanCommandConstructor<Command>,
): DynamoClient {
  return {
    scan(input) {
      return documentClient.send(new ScanCommandCtor(input))
    },
  }
}

export interface DynamoSyncAdapterOptions {
  client: DynamoClient
  table: string
  externalIdColumn?: string
  watermarkColumn?: string
  pageSize?: number
}

function sourceType(value: unknown): SourceColumnType {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === 'string') ? 'tags' : 'custom'
  }
  if (value instanceof Uint8Array) return 'binary'
  if (value instanceof Set) {
    return [...value].every((entry) => typeof entry === 'string') ? 'tags' : 'custom'
  }
  if (typeof value === 'object') return 'custom'
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

type EncodedKeyAttribute =
  | { type: 'string', value: string }
  | { type: 'number', value: number }
  | { type: 'binary', value: string }

interface EncodedCursor {
  version: 1
  key: Record<string, EncodedKeyAttribute>
}

function binaryToBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
}

function base64ToBinary(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function serializeCursor(key: Record<string, unknown>): SyncCursor {
  const encoded: Record<string, EncodedKeyAttribute> = {}
  for (const [name, value] of Object.entries(key)) {
    if (typeof value === 'bigint') {
      throw new TypeError(
        `Dynamo cursor cannot serialize BigInt key attribute "${name}"; configure the document client to return a string or number`,
      )
    }
    if (typeof value === 'string') encoded[name] = { type: 'string', value }
    else if (typeof value === 'number') encoded[name] = { type: 'number', value }
    else if (value instanceof Uint8Array) encoded[name] = { type: 'binary', value: binaryToBase64(value) }
    else throw new TypeError(`Dynamo cursor key attribute "${name}" must be a string, number, or Uint8Array`)
  }
  return JSON.stringify({ version: 1, key: encoded } satisfies EncodedCursor)
}

function deserializeCursor(cursor: SyncCursor): Record<string, unknown> {
  const parsed = JSON.parse(cursor) as Partial<EncodedCursor>
  if (parsed.version !== 1 || typeof parsed.key !== 'object' || parsed.key === null) {
    throw new TypeError('Dynamo sync cursor is invalid')
  }

  return Object.fromEntries(Object.entries(parsed.key).map(([name, attribute]) => {
    if (attribute.type === 'string' || attribute.type === 'number') return [name, attribute.value]
    if (attribute.type === 'binary') return [name, base64ToBinary(attribute.value)]
    throw new TypeError(`Dynamo sync cursor has an invalid type for key attribute "${name}"`)
  }))
}

export class DynamoSyncAdapter implements SyncAdapter {
  readonly id: string
  readonly capabilities = { snapshotConsistent: false } as const
  private readonly pageSize: number

  constructor(private readonly options: DynamoSyncAdapterOptions) {
    this.id = `dynamo:${options.table}`
    this.pageSize = options.pageSize ?? 100
  }

  async describeSchema(): Promise<SourceSchema> {
    const page = await this.options.client.scan({ TableName: this.options.table, Limit: this.pageSize })
    const items = page.Items ?? []
    if (items.length === 0) {
      return {
        columns: [],
        warning: `Dynamo table "${this.options.table}" returned no sample items; schema inference produced no columns`,
      }
    }
    return { columns: inferSchema(items) }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const input: DynamoScanInput = {
      TableName: this.options.table,
      Limit: this.pageSize,
    }
    if (cursor !== undefined) input.ExclusiveStartKey = deserializeCursor(cursor)

    const page = await this.options.client.scan(input)
    const nextCursor = page.LastEvaluatedKey === undefined
      ? null
      : serializeCursor(page.LastEvaluatedKey)

    return {
      rows: page.Items ?? [],
      cursor: nextCursor,
      done: nextCursor === null,
    }
  }

}
