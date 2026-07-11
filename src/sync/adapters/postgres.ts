import type { SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

export interface PostgresClient {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>
}

export interface PostgresSyncAdapterOptions {
  client: PostgresClient
  table: string
  schema?: string
  externalIdColumn?: string
  keyColumn?: string
  watermarkColumn?: string
  pageSize?: number
}

interface InformationSchemaColumn {
  column_name: string
  data_type: string
  is_nullable: string
}

interface CompositeCursor {
  watermark: unknown
  key: unknown
}

function parseCompositeCursor(cursor: SyncCursor): CompositeCursor {
  const parsed = JSON.parse(cursor) as Partial<CompositeCursor>
  if (!('watermark' in parsed) || !('key' in parsed)) {
    throw new TypeError('Postgres sync cursor is invalid')
  }
  return { watermark: parsed.watermark, key: parsed.key }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

export class PostgresSyncAdapter implements SyncAdapter {
  readonly id: string
  readonly capabilities = { snapshotConsistent: true } as const
  private readonly schema: string
  private readonly pageSize: number

  constructor(private readonly options: PostgresSyncAdapterOptions) {
    this.schema = options.schema ?? 'public'
    this.pageSize = options.pageSize ?? 100
    this.id = `postgres:${this.schema}.${options.table}`
  }

  async describeSchema(): Promise<SourceSchema> {
    const { rows } = await this.options.client.query(
      `SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position`,
      [this.schema, this.options.table],
    )

    return {
      columns: (rows as unknown as InformationSchemaColumn[]).map((row) => ({
        name: row.column_name,
        sourceType: row.data_type,
        nullable: row.is_nullable === 'YES',
      })),
    }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const watermarkColumn = this.options.watermarkColumn
    const externalIdColumn = this.options.externalIdColumn ?? 'id'
    const cursorColumn = watermarkColumn ?? this.options.keyColumn ?? externalIdColumn
    const quotedColumn = quoteIdentifier(cursorColumn)
    const quotedExternalId = quoteIdentifier(externalIdColumn)
    const table = `${quoteIdentifier(this.schema)}.${quoteIdentifier(this.options.table)}`
    const state = watermarkColumn !== undefined && cursor !== undefined
      ? parseCompositeCursor(cursor)
      : undefined
    const orderBy = watermarkColumn
      ? `${quotedColumn}, ${quotedExternalId}`
      : quotedColumn
    const sql = cursor === undefined
      ? `SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT $1`
      : state
        ? `SELECT * FROM ${table} WHERE ${quotedColumn} > $1 OR (${quotedColumn} = $2 AND ${quotedExternalId} > $3) ORDER BY ${orderBy} LIMIT $4`
        : `SELECT * FROM ${table} WHERE ${quotedColumn} > $1 ORDER BY ${orderBy} LIMIT $2`
    const params = cursor === undefined
      ? [this.pageSize]
      : state
        ? [state.watermark, state.watermark, state.key, this.pageSize]
        : [cursor, this.pageSize]
    const { rows } = await this.options.client.query(sql, params)

    if (rows.length === 0) {
      return { rows: [], cursor: cursor ?? null, done: true }
    }

    const lastValue = rows[rows.length - 1]?.[cursorColumn]
    if (lastValue === undefined || lastValue === null) {
      throw new Error(`Postgres sync cursor column ${cursorColumn} is missing`)
    }

    if (watermarkColumn) {
      const key = rows[rows.length - 1]?.[externalIdColumn]
      if (key === undefined || key === null) {
        throw new Error(`Postgres sync external id column ${externalIdColumn} is missing`)
      }
      return { rows, cursor: JSON.stringify({ watermark: lastValue, key }), done: false }
    }

    return { rows, cursor: String(lastValue), done: false }
  }
}
