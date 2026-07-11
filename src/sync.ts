export type {
  DeletionPolicy,
  SourceColumn,
  SourceSchema,
  SyncAdapter,
  SyncCursor,
  SyncEngineOptions,
  SyncPage,
  SyncPhase,
  SyncProgress,
  SyncProgressCallback,
  SyncRunResult,
  SyncTarget,
} from './sync/types'

export { createPollingHandle, SyncEngine } from './sync/engine'
export type { PollingHandle } from './sync/engine'
export { inferColumns } from './sync/infer-columns'
export { SQLiteSyncAdapter } from './sync/adapters/sqlite'
export type {
  SQLiteClient,
  SQLiteStatement,
  SQLiteSyncAdapterOptions,
} from './sync/adapters/sqlite'
