import { describe, expect, it, vi } from 'vitest'
import { PostgresSyncAdapter } from './postgres'
import type { PostgresClient } from './postgres'

function createMockClient(overrides?: Partial<PostgresClient>): PostgresClient {
  return {
    query: vi.fn(),
    ...overrides,
  }
}

describe('PostgresSyncAdapter', () => {
  it('describes information_schema columns', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'changed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    ] })
    const adapter = new PostgresSyncAdapter({
      client: createMockClient({ query }),
      schema: 'ledger',
      table: 'transactions',
    })

    const schema = await adapter.describeSchema()

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.columns'),
      ['ledger', 'transactions'],
    )
    expect(schema).toEqual({ columns: [
      { name: 'id', sourceType: 'uuid', nullable: false },
      { name: 'changed_at', sourceType: 'timestamp with time zone', nullable: true },
    ] })
  })

  it('resumes keyset pagination across three pages', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
    const adapter = new PostgresSyncAdapter({
      client: createMockClient({ query }),
      table: 'transactions',
      externalIdColumn: 'id',
      pageSize: 2,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)
    const third = await adapter.pull(second.cursor ?? undefined)

    expect(first).toEqual({ rows: [{ id: 1 }, { id: 2 }], cursor: '2', done: false })
    expect(second).toEqual({ rows: [{ id: 3 }], cursor: '3', done: false })
    expect(third).toEqual({ rows: [], cursor: '3', done: true })
    expect(query).toHaveBeenNthCalledWith(1, expect.not.stringContaining('WHERE'), [2])
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE "id" > $1'), ['2', 2])
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('WHERE "id" > $1'), ['3', 2])
  })

  it('uses a configured watermark column instead of the external id', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'a', changed_at: '2026-07-11T10:00:00Z' }] })
    const adapter = new PostgresSyncAdapter({
      client: createMockClient({ query }),
      table: 'transactions',
      externalIdColumn: 'id',
      watermarkColumn: 'changed_at',
    })

    const page = await adapter.pull('{"watermark":"2026-07-11T09:00:00Z","key":"previous"}')

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "changed_at" > $1 OR ("changed_at" = $2 AND "id" > $3) ORDER BY "changed_at", "id"'),
      ['2026-07-11T09:00:00Z', '2026-07-11T09:00:00Z', 'previous', 100],
    )
    expect(page.cursor).toBe('{"watermark":"2026-07-11T10:00:00Z","key":"a"}')
  })

  it('supports a configured key column independently of the external id', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ external_id: 'a', sequence: 7 }] })
    const adapter = new PostgresSyncAdapter({
      client: createMockClient({ query }),
      table: 'events',
      externalIdColumn: 'external_id',
      keyColumn: 'sequence',
    })

    const page = await adapter.pull('6')

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "sequence" > $1 ORDER BY "sequence"'),
      ['6', 100],
    )
    expect(page.cursor).toBe('7')
  })

  it('uses a composite watermark and external-id cursor across a three-row tie', async () => {
    const tiedRows = [
      { id: 'a', changed_at: '2026-07-11T10:00:00Z' },
      { id: 'b', changed_at: '2026-07-11T10:00:00Z' },
      { id: 'c', changed_at: '2026-07-11T10:00:00Z' },
    ]
    const query = vi.fn((_sql: string, params?: unknown[]) => Promise.resolve({
      rows: params?.length === 1
        ? tiedRows.slice(0, 2)
        : tiedRows.filter((row) => row.id > String(params?.[2])).slice(0, 2),
    }))
    const adapter = new PostgresSyncAdapter({
      client: createMockClient({ query }),
      table: 'transactions',
      externalIdColumn: 'id',
      watermarkColumn: 'changed_at',
      pageSize: 2,
    })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)

    expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(first.cursor ?? '')).toEqual({ watermark: '2026-07-11T10:00:00Z', key: 'b' })
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE "changed_at" > $1 OR ("changed_at" = $2 AND "id" > $3) ORDER BY "changed_at", "id"'),
      ['2026-07-11T10:00:00Z', '2026-07-11T10:00:00Z', 'b', 2],
    )
  })
})
