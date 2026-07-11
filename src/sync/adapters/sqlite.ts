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
  select?: string[]
  externalIdColumn?: string
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
  readonly capabilities = { snapshotConsistent: true } as const
  private readonly pageSize: number

  constructor(private readonly options: SQLiteSyncAdapterOptions) {
    if (options.select !== undefined && !Array.isArray(options.select)) {
      throw new TypeError('SQLite select must be an array of column names')
    }
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
    const externalIdColumn = this.options.externalIdColumn ?? 'id'
    const select = this.selectClause()
    const cursorColumn = watermarkColumn ? quoteIdentifier(watermarkColumn) : 'rowid'
    const selected = watermarkColumn ? select : `${select}, rowid AS "__sync_rowid"`
    const firstWatermarkPage = watermarkColumn !== undefined && cursor === undefined
    const state = watermarkColumn !== undefined && cursor !== undefined
      ? this.parseCompositeCursor(cursor)
      : undefined
    const externalId = quoteIdentifier(externalIdColumn)
    const sql = firstWatermarkPage
      ? `SELECT ${selected} FROM ${quoteIdentifier(this.options.table)} ORDER BY ${cursorColumn}, ${externalId} LIMIT ?`
      : state
        ? `SELECT ${selected} FROM ${quoteIdentifier(this.options.table)} WHERE ${cursorColumn} > ? OR (${cursorColumn} = ? AND ${externalId} > ?) ORDER BY ${cursorColumn}, ${externalId} LIMIT ?`
        : `SELECT ${selected} FROM ${quoteIdentifier(this.options.table)} WHERE ${cursorColumn} > ? ORDER BY ${cursorColumn} LIMIT ?`
    const args = firstWatermarkPage
      ? [this.pageSize]
      : state
        ? [state.watermark, state.watermark, state.key, this.pageSize]
        : [cursor ?? 0, this.pageSize]
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

    if (watermarkColumn) {
      const key = rows[rows.length - 1]?.[externalIdColumn]
      if (key === undefined || key === null) {
        throw new Error(`SQLite sync external id column ${externalIdColumn} is missing`)
      }
      return { rows: cleanRows, cursor: JSON.stringify({ watermark: lastValue, key }), done: false }
    }

    return { rows: cleanRows, cursor: String(lastValue), done: false }
  }

  private parseCompositeCursor(cursor: SyncCursor): { watermark: unknown, key: unknown } {
    const parsed = JSON.parse(cursor) as { watermark?: unknown, key?: unknown }
    if (!('watermark' in parsed) || !('key' in parsed)) {
      throw new TypeError('SQLite sync cursor is invalid')
    }
    return { watermark: parsed.watermark, key: parsed.key }
  }

  private selectClause(): string {
    return this.options.select?.map(quoteIdentifier).join(', ') ?? '*'
  }
}
