import type { SourceSchema, SyncAdapter, SyncCursor, SyncPage } from '../types'

export interface SQLiteStatement {
  all(...args: unknown[]): unknown[]
  get(...args: unknown[]): unknown
}

export interface SQLiteClient {
  prepare(sql: string): SQLiteStatement
}

export interface SQLiteSyncAdapterOptions {
  client: SQLiteClient
  table: string
  select?: string | string[]
  watermarkColumn?: string
  pageSize?: number
}

interface PragmaColumn {
  name: string
  type: string
  notnull: number
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('SQLite adapter expected each row to be an object')
  }
  return value as Record<string, unknown>
}

export class SQLiteSyncAdapter implements SyncAdapter {
  readonly id: string
  private readonly pageSize: number

  constructor(private readonly options: SQLiteSyncAdapterOptions) {
    this.id = `sqlite:${options.table}`
    this.pageSize = options.pageSize ?? 100
  }

  async describeSchema(): Promise<SourceSchema> {
    const sql = `PRAGMA table_info(${quoteIdentifier(this.options.table)})`
    const rows = this.options.client.prepare(sql).all().map(asRecord) as unknown as PragmaColumn[]
    return {
      columns: rows.map((row) => ({
        name: row.name,
        sourceType: row.type,
        nullable: row.notnull === 0,
      })),
    }
  }

  async pull(cursor?: SyncCursor): Promise<SyncPage> {
    const watermarkColumn = this.options.watermarkColumn
    const select = this.selectClause()
    const cursorColumn = watermarkColumn ? quoteIdentifier(watermarkColumn) : 'rowid'
    const selected = watermarkColumn ? select : `${select}, rowid AS "__sync_rowid"`
    const firstWatermarkPage = watermarkColumn !== undefined && cursor === undefined
    const sql = firstWatermarkPage
      ? `SELECT ${selected} FROM ${quoteIdentifier(this.options.table)} ORDER BY ${cursorColumn} LIMIT ?`
      : `SELECT ${selected} FROM ${quoteIdentifier(this.options.table)} WHERE ${cursorColumn} > ? ORDER BY ${cursorColumn} LIMIT ?`
    const args = firstWatermarkPage ? [this.pageSize] : [cursor ?? 0, this.pageSize]
    const rows = this.options.client.prepare(sql).all(...args).map(asRecord)

    if (rows.length === 0) {
      return { rows: [], cursor: cursor ?? null, done: true }
    }

    const cursorKey = watermarkColumn ?? '__sync_rowid'
    const lastValue = rows[rows.length - 1]?.[cursorKey]
    if (lastValue === undefined || lastValue === null) {
      throw new Error(`SQLite sync cursor column ${cursorKey} is missing`)
    }

    const cleanRows = watermarkColumn
      ? rows
      : rows.map(({ __sync_rowid: _rowid, ...row }) => row)

    return { rows: cleanRows, cursor: String(lastValue), done: false }
  }

  private selectClause(): string {
    if (Array.isArray(this.options.select)) {
      return this.options.select.map(quoteIdentifier).join(', ')
    }
    return this.options.select ?? '*'
  }
}
