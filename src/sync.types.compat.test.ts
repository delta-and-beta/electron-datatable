import { SQLiteSyncAdapter } from './sync'
import type { SQLiteClient, SourceColumnType, SyncTarget } from './sync'
import { describe, expect, it } from 'vitest'

const synchronousTarget = {
  upsert(_externalId: string, _row: Record<string, unknown>) {},
  delete(_externalId: string) {},
  async listIds() { return [] },
} satisfies SyncTarget

const asynchronousTarget = {
  async upsert(_externalId: string, _row: Record<string, unknown>) {},
  async delete(_externalId: string) {},
  async listIds() { return [] },
} satisfies SyncTarget

const transactionalTarget = {
  upsert(_externalId: string, _row: Record<string, unknown>) {},
  begin() {},
  commitTx() {},
  rollback() {},
} satisfies SyncTarget

void synchronousTarget
void asynchronousTarget
void transactionalTarget

const sqliteClient = { prepare() { return { all() { return [] }, get() {} } } } satisfies SQLiteClient
new SQLiteSyncAdapter({ client: sqliteClient, table: 'events', select: ['id'] })
function assertRawSelectIsRejected(): void {
  // @ts-expect-error raw SQL select strings are intentionally unsupported
  new SQLiteSyncAdapter({ client: sqliteClient, table: 'events', select: 'id, unsafe_expression()' })
}
void assertRawSelectIsRejected

const sourceColumnType: SourceColumnType = 'tags'
void sourceColumnType

describe('SyncTarget type compatibility', () => {
  it('accepts synchronous and asynchronous write implementations', () => {
    expect(synchronousTarget).toBeDefined()
    expect(asynchronousTarget).toBeDefined()
    expect(transactionalTarget).toBeDefined()
  })
})
