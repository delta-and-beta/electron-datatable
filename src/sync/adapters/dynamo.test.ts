import { describe, expect, it, vi } from 'vitest'
import { DynamoSyncAdapter } from './dynamo'
import type { DynamoClient } from './dynamo'

function createMockClient(overrides?: Partial<DynamoClient>): DynamoClient {
  return {
    scan: vi.fn(),
    ...overrides,
  }
}

describe('DynamoSyncAdapter', () => {
  it('infers a union schema from sampled schemaless items', async () => {
    const scan = vi.fn().mockResolvedValue({ Items: [
      { id: 'a', count: 2, active: true, tags: ['one', 'two'], metadata: { source: 'api' } },
      { id: 'b', optional: null },
    ] })
    const adapter = new DynamoSyncAdapter({
      client: createMockClient({ scan }),
      table: 'events',
    })

    const schema = await adapter.describeSchema()

    expect(scan).toHaveBeenCalledWith({ TableName: 'events', Limit: 100 })
    expect(schema).toEqual({ columns: [
      { name: 'id', sourceType: 'string', nullable: false },
      { name: 'count', sourceType: 'number', nullable: true },
      { name: 'active', sourceType: 'boolean', nullable: true },
      { name: 'tags', sourceType: 'ARRAY<STRING>', nullable: true },
      { name: 'metadata', sourceType: 'map', nullable: true },
      { name: 'optional', sourceType: 'null', nullable: true },
    ] })
  })

  it('resumes scans across three pages with a JSON cursor', async () => {
    const scan = vi.fn()
      .mockResolvedValueOnce({ Items: [{ id: 'a' }], LastEvaluatedKey: { id: 'a' } })
      .mockResolvedValueOnce({ Items: [{ id: 'b' }], LastEvaluatedKey: { id: 'b' } })
      .mockResolvedValueOnce({ Items: [{ id: 'c' }] })
    const adapter = new DynamoSyncAdapter({
      client: createMockClient({ scan }),
      table: 'events',
      pageSize: 1,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)
    const third = await adapter.pull(second.cursor ?? undefined)

    expect(first).toEqual({ rows: [{ id: 'a' }], cursor: '{"id":"a"}', done: false })
    expect(second).toEqual({ rows: [{ id: 'b' }], cursor: '{"id":"b"}', done: false })
    expect(third).toEqual({ rows: [{ id: 'c' }], cursor: null, done: true })
    expect(scan).toHaveBeenNthCalledWith(1, { TableName: 'events', Limit: 1 })
    expect(scan).toHaveBeenNthCalledWith(2, { TableName: 'events', Limit: 1, ExclusiveStartKey: { id: 'a' } })
    expect(scan).toHaveBeenNthCalledWith(3, { TableName: 'events', Limit: 1, ExclusiveStartKey: { id: 'b' } })
  })
})
