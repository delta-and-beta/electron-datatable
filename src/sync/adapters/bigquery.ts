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
  offset: number
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '\\`')}\``
}

function cursorEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function parseCursor(cursor: SyncCursor): BigQueryCursor {
  const parsed = JSON.parse(cursor) as Partial<BigQueryCursor>
  if (!('watermark' in parsed) || typeof parsed.offset !== 'number') {
    throw new TypeError('BigQuery sync cursor is invalid')
  }
  return { watermark: parsed.watermark, offset: parsed.offset }
}

export class BigQuerySyncAdapter implements SyncAdapter {
  readonly id: string
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
    const table = this.options.project
      ? `${this.options.project}.${this.options.dataset}.${this.options.table}`
      : `${this.options.dataset}.${this.options.table}`
    const query = state === undefined
      ? `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${watermark} LIMIT @pageSize`
      : `SELECT * FROM ${quoteIdentifier(table)} WHERE ${watermark} >= @watermark ORDER BY ${watermark} LIMIT @pageSize OFFSET @offset`
    const params = state === undefined
      ? { pageSize: this.pageSize }
      : { watermark: state.watermark, offset: state.offset, pageSize: this.pageSize }
    const [rows] = await this.options.client.query({ query, params })

    if (rows.length === 0) {
      return { rows: [], cursor: cursor ?? null, done: true }
    }

    const lastWatermark = rows[rows.length - 1]?.[this.options.watermarkColumn]
    if (lastWatermark === undefined || lastWatermark === null) {
      throw new Error(`BigQuery sync watermark column ${this.options.watermarkColumn} is missing`)
    }

    let trailingCount = 0
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (!cursorEquals(rows[index]?.[this.options.watermarkColumn], lastWatermark)) break
      trailingCount += 1
    }
    const offset = state && cursorEquals(state.watermark, lastWatermark)
      ? state.offset + trailingCount
      : trailingCount

    return {
      rows,
      cursor: JSON.stringify({ watermark: lastWatermark, offset }),
      done: false,
    }
  }
}
