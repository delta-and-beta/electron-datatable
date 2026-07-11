import type { SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

export interface BigQueryOptions {
  query: string
  params?: unknown
}

export interface BigQueryClient {
  query(options: BigQueryOptions): Promise<[Record<string, unknown>[]]>
}

export interface BigQuerySyncAdapterOptions {
  client: BigQueryClient
  project?: string
  dataset: string
  table: string
  externalIdColumn?: string
  watermarkColumn: string
  pageSize?: number
}

interface InformationSchemaColumn {
  column_name: string
  data_type: string
  is_nullable: string
}

interface BigQueryCursor {
  watermark: unknown
  key: unknown
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '\\`')}\``
}

function parseCursor(cursor: SyncCursor): BigQueryCursor {
  const parsed = JSON.parse(cursor) as Partial<BigQueryCursor>
  if (!('watermark' in parsed) || !('key' in parsed)) {
    throw new TypeError('BigQuery sync cursor is invalid')
  }
  return { watermark: parsed.watermark, key: parsed.key }
}

export class BigQuerySyncAdapter implements SyncAdapter {
  readonly id: string
  readonly capabilities = { snapshotConsistent: true } as const
  private readonly pageSize: number

  constructor(private readonly options: BigQuerySyncAdapterOptions) {
    this.id = `bigquery:${options.dataset}.${options.table}`
    this.pageSize = options.pageSize ?? 100
  }

  async describeSchema(): Promise<SourceSchema> {
    const informationSchema = this.options.project
      ? `${this.options.project}.${this.options.dataset}.INFORMATION_SCHEMA.COLUMNS`
      : `${this.options.dataset}.INFORMATION_SCHEMA.COLUMNS`
    const [rows] = await this.options.client.query({
      query: `SELECT column_name, data_type, is_nullable
FROM ${quoteIdentifier(informationSchema)}
WHERE table_name = @table
ORDER BY ordinal_position`,
      params: { table: this.options.table },
    })

    return {
      columns: (rows as unknown as InformationSchemaColumn[]).map((row) => ({
        name: row.column_name,
        sourceType: row.data_type,
        nullable: row.is_nullable === 'YES',
      })),
    }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const state = cursor === undefined ? undefined : parseCursor(cursor)
    const watermark = quoteIdentifier(this.options.watermarkColumn)
    const externalIdColumn = this.options.externalIdColumn ?? 'id'
    const externalId = quoteIdentifier(externalIdColumn)
    const table = this.options.project
      ? `${this.options.project}.${this.options.dataset}.${this.options.table}`
      : `${this.options.dataset}.${this.options.table}`
    const query = state === undefined
      ? `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${watermark}, ${externalId} LIMIT @pageSize`
      : `SELECT * FROM ${quoteIdentifier(table)} WHERE ${watermark} > @watermark OR (${watermark} = @watermark AND ${externalId} > @key) ORDER BY ${watermark}, ${externalId} LIMIT @pageSize`
    const params = state === undefined
      ? { pageSize: this.pageSize }
      : { watermark: state.watermark, key: state.key, pageSize: this.pageSize }
    const [rows] = await this.options.client.query({ query, params })

    if (rows.length === 0) {
      return { rows: [], cursor: cursor ?? null, done: true }
    }

    const lastWatermark = rows[rows.length - 1]?.[this.options.watermarkColumn]
    if (lastWatermark === undefined || lastWatermark === null) {
      throw new Error(`BigQuery sync watermark column ${this.options.watermarkColumn} is missing`)
    }

    const key = rows[rows.length - 1]?.[externalIdColumn]
    if (key === undefined || key === null) {
      throw new Error(`BigQuery sync external id column ${externalIdColumn} is missing`)
    }

    return {
      rows,
      cursor: JSON.stringify({ watermark: lastWatermark, key }),
      done: false,
    }
  }
}
