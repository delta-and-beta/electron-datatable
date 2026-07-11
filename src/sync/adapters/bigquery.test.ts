import { describe, expect, it, vi } from 'vitest'
import { BigQuerySyncAdapter } from './bigquery'
import type { BigQueryClient } from './bigquery'

function createMockClient(overrides?: Partial<BigQueryClient>): BigQueryClient {
  return {
    query: vi.fn(),
    ...overrides,
  }
}

describe('BigQuerySyncAdapter', () => {
  it('describes configured dataset table columns', async () => {
    const query = vi.fn().mockResolvedValue([[ 
      { column_name: 'id', data_type: 'STRING', is_nullable: 'NO' },
      { column_name: 'changed_at', data_type: 'TIMESTAMP', is_nullable: 'YES' },
    ]])
    const adapter = new BigQuerySyncAdapter({
      client: createMockClient({ query }),
      project: 'finance-prod',
      dataset: 'ledger',
      table: 'transactions',
      watermarkColumn: 'changed_at',
    })

    const schema = await adapter.describeSchema()

    expect(query).toHaveBeenCalledWith({
      query: expect.stringContaining('`finance-prod.ledger.INFORMATION_SCHEMA.COLUMNS`'),
      params: { table: 'transactions' },
    })
    expect(schema).toEqual({ columns: [
      { name: 'id', sourceType: 'STRING', nullable: false },
      { name: 'changed_at', sourceType: 'TIMESTAMP', nullable: true },
    ] })
  })

  it('resumes watermark pagination across three pages', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[{ id: 'a', changed_at: '2026-07-11T10:00:00Z' }]])
      .mockResolvedValueOnce([[{ id: 'b', changed_at: '2026-07-11T11:00:00Z' }]])
      .mockResolvedValueOnce([[]])
    const adapter = new BigQuerySyncAdapter({
      client: createMockClient({ query }),
      dataset: 'ledger',
      table: 'transactions',
      watermarkColumn: 'changed_at',
      pageSize: 1,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)
    const third = await adapter.pull(second.cursor ?? undefined)

    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', offset: 1 })
    expect(JSON.parse(second.cursor ?? '')).toEqual({ watermark: '2026-07-11T11:00:00Z', offset: 1 })
    expect(third).toEqual({ rows: [], cursor: second.cursor, done: true })
    expect(query).toHaveBeenNthCalledWith(2, {
      query: expect.stringContaining('WHERE `changed_at` >= @watermark'),
      params: { watermark: '2026-07-11T10:00:00Z', offset: 1, pageSize: 1 },
    })
  })

  it('uses the cursor offset to resume rows sharing a watermark', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[
        { id: 'a', changed_at: '2026-07-11T10:00:00Z' },
        { id: 'b', changed_at: '2026-07-11T10:00:00Z' },
      ]])
      .mockResolvedValueOnce([[
        { id: 'c', changed_at: '2026-07-11T10:00:00Z' },
        { id: 'd', changed_at: '2026-07-11T11:00:00Z' },
      ]])
    const adapter = new BigQuerySyncAdapter({
      client: createMockClient({ query }),
      dataset: 'ledger',
      table: 'transactions',
      watermarkColumn: 'changed_at',
      pageSize: 2,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)

    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', offset: 2 })
    expect(JSON.parse(second.cursor ?? '')).toEqual({ watermark: '2026-07-11T11:00:00Z', offset: 1 })
    expect(query).toHaveBeenNthCalledWith(2, {
      query: expect.stringContaining('OFFSET @offset'),
      params: { watermark: '2026-07-11T10:00:00Z', offset: 2, pageSize: 2 },
    })
  })
})
