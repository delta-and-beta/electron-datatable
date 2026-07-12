import { AirtableSyncAdapter, SQLiteSyncAdapter } from './sync'
import type {
  AirtableClient,
  AirtableSyncAdapterOptions,
  SQLiteClient,
  SourceColumnType,
  SourceColumn,
  SyncAdapter,
  SyncPushChange,
  SyncPushRecordResult,
  SyncTarget,
} from './sync'
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

const sourceColumnMetadata = {
  name: 'Stage',
  sourceType: 'string',
  metadata: {
    fieldId: 'fldStage',
    description: 'Current pipeline stage',
    options: ['Lead'],
    airtableOptions: { choices: [{ id: 'selLead', name: 'Lead' }] },
  },
} satisfies SourceColumn
void sourceColumnMetadata

const airtableClient = { async request(_path: string, _params?: Record<string, string>) { return {} } } satisfies AirtableClient
const airtableOptions = {
  client: airtableClient,
  baseId: 'appBase',
  table: 'Companies',
  retryDelayMs: 1000,
  rateLimitDelayMs: 30_000,
} satisfies AirtableSyncAdapterOptions
new AirtableSyncAdapter(airtableOptions)

const pushChanges: SyncPushChange[] = [{ externalId: 'rec1', fields: { Name: 'Updated' } }]
const pushResults: SyncPushRecordResult[] = [{ externalId: 'rec1', ok: true }]
const pushAdapter = {
  id: 'push-adapter',
  capabilities: { canPush: true },
  pushBatchSize: 10,
  async describeSchema() { return { columns: [] } },
  async pull() { return { rows: [], cursor: null, done: true } },
  async push(_changes: SyncPushChange[]) { return pushResults },
} satisfies SyncAdapter
void pushChanges
void pushAdapter

describe('SyncTarget type compatibility', () => {
  it('accepts synchronous and asynchronous write implementations', () => {
    expect(synchronousTarget).toBeDefined()
    expect(asynchronousTarget).toBeDefined()
    expect(transactionalTarget).toBeDefined()
  })
})
