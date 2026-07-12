export interface SourceColumn {
  name: string
  sourceType: string
  nullable?: boolean
  /** Whether the source accepts writes to this field. */
  writable?: boolean
  /** Adapter-native field type, retained for editor and write semantics. */
  fieldKind?: string
  metadata?: {
    symbol?: string
    precision?: number
  }
}

export type SourceColumnType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'tags'
  | 'custom'
  | 'null'
  | 'binary'
  | 'unknown'

export interface SourceSchema {
  columns: SourceColumn[]
  warning?: string
}

/** Opaque adapter-owned paging or watermark token. */
export type SyncCursor = string

export interface SyncPage {
  rows: Record<string, unknown>[]
  cursor: SyncCursor | null
  done: boolean
}

export interface SyncPushChange {
  externalId: string
  fields: Record<string, unknown>
}

export interface SyncPushRecordResult {
  externalId: string
  ok: boolean
  error?: string
}

export interface SyncAdapter {
  readonly id: string
  readonly capabilities?: {
    snapshotConsistent?: boolean
    canPush?: boolean
  }
  readonly pushBatchSize?: number
  describeSchema(): Promise<SourceSchema>
  pull(cursor?: SyncCursor): Promise<SyncPage>
  push?(changes: SyncPushChange[]): Promise<SyncPushRecordResult[]>
  close?(): Promise<void>
}

export interface SyncTarget {
  /**
   * Writes are best-effort per row unless all three transaction hooks are
   * provided. Transactional targets make the complete apply phase atomic.
   */
  upsert(externalId: string, row: Record<string, unknown>): void | Promise<void>
  delete?(externalId: string): void | Promise<void>
  listIds?(): Promise<string[]>
  begin?(): void | Promise<void>
  commitTx?(): void | Promise<void>
  rollback?(): void | Promise<void>
}

export interface SyncRunResult {
  fetched: number
  created: number
  updated: number
  deleted: number
  errors: string[]
  startedAt: string
  finishedAt: string
  cursor: SyncCursor | null
}

export type SyncPhase = 'idle' | 'schema' | 'pulling' | 'writing' | 'reconciling' | 'done' | 'error'

export interface SyncProgress {
  phase: SyncPhase
  current: number
  total?: number
  message?: string
}

export type DeletionPolicy = 'ignore' | 'markMissing' | 'delete'

export interface SyncEngineOptions {
  externalIdField: string
  watermark?: SyncCursor
  deletionPolicy?: DeletionPolicy
  pageLimit?: number
  /** Stop best-effort targets after their first failed row. Defaults to false. */
  stopOnError?: boolean
}

export type SyncProgressCallback = (progress: SyncProgress) => void
