import { describe, expect, it, vi } from 'vitest'
import { DynamoSyncAdapter, fromDocumentClient } from './dynamo'
import { SyncEngine } from '../engine'
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
      { id: 'a', count: 2, active: true, tags: ['one', 'two'], labels: new Set(['red']), metadata: { source: 'api' } },
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
      { name: 'tags', sourceType: 'tags', nullable: true },
      { name: 'labels', sourceType: 'tags', nullable: true },
      { name: 'metadata', sourceType: 'custom', nullable: true },
      { name: 'optional', sourceType: 'null', nullable: true },
    ] })
  })

  it('returns and surfaces a warning when no items are available for schema inference', async () => {
    const scan = vi.fn().mockResolvedValue({ Items: [] })
    const adapter = new DynamoSyncAdapter({
      client: createMockClient({ scan }),
      table: 'empty-events',
    })

    const schema = await adapter.describeSchema()
    const result = await new SyncEngine(
      adapter,
      { upsert: vi.fn() },
      { externalIdField: 'id' },
    ).dryRun()

    const warning = 'Dynamo table "empty-events" returned no sample items; schema inference produced no columns'
    expect(schema).toEqual({ columns: [], warning })
    expect(result.errors).toContain(warning)
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

    expect(first).toEqual({ rows: [{ id: 'a' }], cursor: expect.any(String), done: false })
    expect(second).toEqual({ rows: [{ id: 'b' }], cursor: expect.any(String), done: false })
    expect(third).toEqual({ rows: [{ id: 'c' }], cursor: null, done: true })
    expect(scan).toHaveBeenNthCalledWith(1, { TableName: 'events', Limit: 1 })
    expect(scan).toHaveBeenNthCalledWith(2, { TableName: 'events', Limit: 1, ExclusiveStartKey: { id: 'a' } })
    expect(scan).toHaveBeenNthCalledWith(3, { TableName: 'events', Limit: 1, ExclusiveStartKey: { id: 'b' } })
  })

  it('round-trips string, number, and binary cursor key attributes', async () => {
    const binary = new Uint8Array([0, 127, 255])
    const scan = vi.fn()
      .mockResolvedValueOnce({
        Items: [{ id: 'a' }],
        LastEvaluatedKey: { partition: 'account', sequence: 42, binary },
      })
      .mockResolvedValueOnce({ Items: [] })
    const adapter = new DynamoSyncAdapter({
      client: createMockClient({ scan }),
      table: 'events',
    })

    const first = await adapter.pull()
    await adapter.pull(first.cursor ?? undefined)

    expect(scan).toHaveBeenNthCalledWith(2, {
      TableName: 'events',
      Limit: 100,
      ExclusiveStartKey: {
        partition: 'account',
        sequence: 42,
        binary: expect.any(Uint8Array),
      },
    })
    expect(scan.mock.calls[1]?.[0].ExclusiveStartKey.binary).toEqual(binary)
  })

  it('rejects BigInt cursor key attributes with a configuration error', async () => {
    const adapter = new DynamoSyncAdapter({
      client: createMockClient({
        scan: vi.fn().mockResolvedValue({
          Items: [{ id: 'a' }],
          LastEvaluatedKey: { id: 1n },
        }),
      }),
      table: 'events',
    })

    await expect(adapter.pull()).rejects.toThrow(
      'Dynamo cursor cannot serialize BigInt key attribute "id"; configure the document client to return a string or number',
    )
  })

  it('adapts a consumer document client with its ScanCommand constructor', async () => {
    class FakeScanCommand {
      constructor(readonly input: Record<string, unknown>) {}
    }
    const send = vi.fn().mockResolvedValue({ Items: [{ id: 'a' }] })
    const client = fromDocumentClient({ send }, FakeScanCommand)

    const result = await client.scan({ TableName: 'events', Limit: 25 })

    expect(send).toHaveBeenCalledWith(expect.any(FakeScanCommand))
    expect(send.mock.calls[0]?.[0].input).toEqual({ TableName: 'events', Limit: 25 })
    expect(result).toEqual({ Items: [{ id: 'a' }] })
  })
})
