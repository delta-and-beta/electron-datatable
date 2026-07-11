import { describe, expect, it, vi } from 'vitest'
import { SQLiteSyncAdapter } from './sqlite'
import type { SQLiteClient } from './sqlite'

function createMockClient(overrides?: Partial<SQLiteClient>): SQLiteClient {
  return {
    prepare: vi.fn(),
    ...overrides,
  }
}

describe('SQLiteSyncAdapter', () => {
  it('describes columns from mocked PRAGMA table_info rows', async () => {
    const all = vi.fn().mockReturnValue([
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 1 },
      { cid: 1, name: 'memo', type: 'TEXT', notnull: 0 },
    ])
    const client = createMockClient({ prepare: vi.fn().mockReturnValue({ all, get: vi.fn() }) })

    const schema = await new SQLiteSyncAdapter({ client, table: 'transactions' }).describeSchema()

    expect(client.prepare).toHaveBeenCalledWith('PRAGMA table_info("transactions")')
    expect(schema).toEqual({ columns: [
      { name: 'id', sourceType: 'INTEGER', nullable: false },
      { name: 'memo', sourceType: 'TEXT', nullable: true },
    ] })
  })

  it('uses rowid keyset pagination across three pages', async () => {
    const all = vi.fn()
      .mockReturnValueOnce([{ __sync_rowid: 1, id: 'a' }, { __sync_rowid: 2, id: 'b' }])
      .mockReturnValueOnce([{ __sync_rowid: 3, id: 'c' }])
      .mockReturnValueOnce([])
    const client = createMockClient({ prepare: vi.fn().mockReturnValue({ all, get: vi.fn() }) })
    const adapter = new SQLiteSyncAdapter({ client, table: 'transactions', pageSize: 2 })

    const first = await adapter.pull()
    const second = await adapter.pull(first.cursor ?? undefined)
    const third = await adapter.pull(second.cursor ?? undefined)

    expect(first).toEqual({ rows: [{ id: 'a' }, { id: 'b' }], cursor: '2', done: false })
    expect(second).toEqual({ rows: [{ id: 'c' }], cursor: '3', done: false })
    expect(third).toEqual({ rows: [], cursor: '3', done: true })
    expect(all).toHaveBeenNthCalledWith(1, 0, 2)
    expect(all).toHaveBeenNthCalledWith(2, '2', 2)
    expect(all).toHaveBeenNthCalledWith(3, '3', 2)
  })

  it('pages by a configured watermark column and honors select', async () => {
    const all = vi.fn().mockReturnValue([{ id: 'a', changed_at: '2026-01-02' }])
    const prepare = vi.fn().mockReturnValue({ all, get: vi.fn() })
    const adapter = new SQLiteSyncAdapter({
      client: createMockClient({ prepare }),
      table: 'transactions',
      select: ['id', 'changed_at'],
      watermarkColumn: 'changed_at',
      pageSize: 10,
    })

    const page = await adapter.pull('2026-01-01')

    expect(prepare).toHaveBeenCalledWith(
      'SELECT "id", "changed_at" FROM "transactions" WHERE "changed_at" > ? ORDER BY "changed_at" LIMIT ?',
    )
    expect(all).toHaveBeenCalledWith('2026-01-01', 10)
    expect(page).toEqual({ rows: [{ id: 'a', changed_at: '2026-01-02' }], cursor: '2026-01-02', done: false })
  })

  it('starts a numeric watermark pull without an empty-string comparison', async () => {
    const all = vi.fn().mockReturnValue([{ id: 'a', sequence: 1 }])
    const prepare = vi.fn().mockReturnValue({ all, get: vi.fn() })
    const adapter = new SQLiteSyncAdapter({
      client: createMockClient({ prepare }),
      table: 'events',
      watermarkColumn: 'sequence',
      pageSize: 10,
    })

    const page = await adapter.pull()

    expect(prepare).toHaveBeenCalledWith(
      'SELECT * FROM "events" ORDER BY "sequence" LIMIT ?',
    )
    expect(all).toHaveBeenCalledWith(10)
    expect(page.cursor).toBe('1')
  })
})
