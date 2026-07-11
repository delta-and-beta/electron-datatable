import { describe, expect, it } from 'vitest'
import { createPollingHandle, inferColumns, SQLiteSyncAdapter, SyncEngine } from './sync'

describe('/sync exports', () => {
  it('exports the core sync runtime through its subpath barrel', () => {
    expect(SyncEngine).toBeTypeOf('function')
    expect(createPollingHandle).toBeTypeOf('function')
    expect(inferColumns).toBeTypeOf('function')
    expect(SQLiteSyncAdapter).toBeTypeOf('function')
  })
})
