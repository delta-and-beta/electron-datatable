import { describe, expect, it } from 'vitest'
import {
  BigQuerySyncAdapter,
  createPollingHandle,
  DynamoSyncAdapter,
  inferColumns,
  PostgresSyncAdapter,
  SQLiteSyncAdapter,
  SyncEngine,
  SyncStatusChip,
  useSyncStatus,
} from './sync'

describe('/sync exports', () => {
  it('exports the core sync runtime through its subpath barrel', () => {
    expect(SyncEngine).toBeTypeOf('function')
    expect(createPollingHandle).toBeTypeOf('function')
    expect(inferColumns).toBeTypeOf('function')
    expect(SQLiteSyncAdapter).toBeTypeOf('function')
    expect(PostgresSyncAdapter).toBeTypeOf('function')
    expect(DynamoSyncAdapter).toBeTypeOf('function')
    expect(BigQuerySyncAdapter).toBeTypeOf('function')
    expect(SyncStatusChip).toBeTypeOf('function')
    expect(useSyncStatus).toBeTypeOf('function')
  })
})
