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

    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', key: 'a' })
    expect(JSON.parse(second.cursor ?? '')).toEqual({ watermark: '2026-07-11T11:00:00Z', key: 'b' })
    expect(third).toEqual({ rows: [], cursor: second.cursor, done: true })
    expect(query).toHaveBeenNthCalledWith(2, {
      query: expect.stringContaining('WHERE `changed_at` > @watermark OR (`changed_at` = @watermark AND `id` > @key)'),
      params: { watermark: '2026-07-11T10:00:00Z', key: 'a', pageSize: 1 },
    })
  })

  it('uses the cursor key to resume rows sharing a watermark', async () => {
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

    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', key: 'b' })
    expect(JSON.parse(second.cursor ?? '')).toEqual({ watermark: '2026-07-11T11:00:00Z', key: 'd' })
    expect(query).toHaveBeenNthCalledWith(2, {
      query: expect.not.stringContaining('OFFSET'),
      params: { watermark: '2026-07-11T10:00:00Z', key: 'b', pageSize: 2 },
    })
  })

  it('uses a composite watermark and external-id cursor across a three-row tie without OFFSET', async () => {
    const tiedRows = [
      { id: 'a', changed_at: '2026-07-11T10:00:00Z' },
      { id: 'b', changed_at: '2026-07-11T10:00:00Z' },
      { id: 'c', changed_at: '2026-07-11T10:00:00Z' },
    ]
    const query = vi.fn((options: { params?: unknown }) => {
      const params = options.params as { key?: string }
      return Promise.resolve([params.key === undefined
        ? tiedRows.slice(0, 2)
        : tiedRows.filter((row) => row.id > params.key).slice(0, 2)] as [Record<string, unknown>[]])
    })
    const adapter = new BigQuerySyncAdapter({
      client: createMockClient({ query }),
      dataset: 'ledger',
      table: 'transactions',
      externalIdColumn: 'id',
      watermarkColumn: 'changed_at',
      pageSize: 2,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)

    expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', key: 'b' })
    expect(query).toHaveBeenNthCalledWith(2, {
      query: expect.stringContaining('WHERE `changed_at` > @watermark OR (`changed_at` = @watermark AND `id` > @key)'),
      params: { watermark: '2026-07-11T10:00:00Z', key: 'b', pageSize: 2 },
    })
    expect(query.mock.calls[1]?.[0].query).not.toContain('OFFSET')
  })
})
