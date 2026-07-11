import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BigQuerySyncAdapter,
  createPollingHandle,
  DynamoSyncAdapter,
  fromDocumentClient,
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
    expect(fromDocumentClient).toBeTypeOf('function')
    expect(BigQuerySyncAdapter).toBeTypeOf('function')
    expect(SyncStatusChip).toBeTypeOf('function')
    expect(useSyncStatus).toBeTypeOf('function')
  })

  it('documents the corrected 0.8.0 sync semantics', () => {
    const changelog = readFileSync(resolve(process.cwd(), 'CHANGELOG.md'), 'utf8')
    const release = changelog.split('## [0.8.0]')[1]?.split('## [0.7.0]')[0] ?? ''

    expect(release).toContain('transactional targets')
    expect(release).toContain('composite keyset cursors')
    expect(release).toContain('fromDocumentClient')
    expect(release).toContain('snapshot capabilities')
    expect(release).toContain('identifier arrays')
  })
})
