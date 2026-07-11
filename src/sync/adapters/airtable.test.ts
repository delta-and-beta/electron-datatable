import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncEngine } from '../engine'
import { AirtableSyncAdapter } from './airtable'
import type { AirtableClient } from './airtable'

function createMockClient(overrides?: Partial<AirtableClient>): AirtableClient {
  return {
    request: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AirtableSyncAdapter', () => {
  it('resumes offset pagination across three pages and preserves terminal cursor semantics', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ records: [{ id: 'rec1', fields: { Name: 'One' } }], offset: 'page-2' })
      .mockResolvedValueOnce({ records: [{ id: 'rec2', fields: { Name: 'Two' } }], offset: 'page-3' })
      .mockResolvedValueOnce({ records: [{ id: 'rec3', fields: { Name: 'Three' } }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      view: 'Active',
      fields: ['Name', 'Email'],
      pageSize: 250,
      interPageDelayMs: 0,
    })

    const first = await adapter.pull()
    const resumed = await adapter.pull('page-2')
    const terminal = await adapter.pull(resumed.cursor ?? undefined)

    expect(first).toEqual({
      rows: [{ airtable_id: 'rec1', Name: 'One' }],
      cursor: 'page-2',
      done: false,
    })
    expect(resumed.cursor).toBe('page-3')
    expect(terminal).toEqual({
      rows: [{ airtable_id: 'rec3', Name: 'Three' }],
      cursor: null,
      done: true,
    })
    expect(request).toHaveBeenNthCalledWith(1, 'appBase/Companies', {
      pageSize: '100',
      view: 'Active',
      'fields[]': 'Name',
      'fields[1]': 'Email',
    })
    expect(request).toHaveBeenNthCalledWith(2, 'appBase/Companies', {
      pageSize: '100',
      offset: 'page-2',
      view: 'Active',
      'fields[]': 'Name',
      'fields[1]': 'Email',
    })
    expect(request).toHaveBeenNthCalledWith(3, 'appBase/Companies', {
      pageSize: '100',
      offset: 'page-3',
      view: 'Active',
      'fields[]': 'Name',
      'fields[1]': 'Email',
    })
  })

  it('flattens fields named like Airtable record properties without losing the record id', async () => {
    const request = vi.fn().mockResolvedValue({ records: [{
      id: 'recStable',
      createdTime: '2026-07-11T00:00:00.000Z',
      fields: { id: 'field-id', createdTime: 'field-created-time', Name: 'Acme' },
    }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    const page = await adapter.pull()

    expect(page.rows).toEqual([{
      airtable_id: 'recStable',
      id: 'field-id',
      createdTime: 'field-created-time',
      Name: 'Acme',
    }])
  })

  it('maps every Airtable metadata field family and includes the implicit record id', async () => {
    const fields = [
      ['singleLineText', 'string'],
      ['multilineText', 'string'],
      ['richText', 'string'],
      ['email', 'string'],
      ['url', 'string'],
      ['phoneNumber', 'string'],
      ['singleSelect', 'string'],
      ['number', 'number'],
      ['currency', 'number'],
      ['percent', 'number'],
      ['rating', 'number'],
      ['duration', 'number'],
      ['autoNumber', 'number'],
      ['date', 'date'],
      ['dateTime', 'date'],
      ['createdTime', 'date'],
      ['lastModifiedTime', 'date'],
      ['checkbox', 'boolean'],
      ['multipleSelects', 'tags'],
      ['multipleRecordLinks', 'tags'],
      ['multipleLookupValues', 'tags'],
      ['formula', 'custom'],
      ['rollup', 'custom'],
      ['barcode', 'custom'],
      ['button', 'custom'],
      ['multipleAttachments', 'custom'],
      ['futureFieldType', 'custom'],
    ] as const
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: fields.map(([type], index) => ({ name: `Field ${index}`, type })),
    }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    const schema = await adapter.describeSchema()

    expect(request).toHaveBeenCalledWith('meta/bases/appBase/tables')
    expect(schema.columns).toEqual([
      { name: 'airtable_id', sourceType: 'string' },
      ...fields.map(([, sourceType], index) => ({ name: `Field ${index}`, sourceType })),
    ])
  })

  it('finds metadata tables by name and rejects a missing configured table', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{ id: 'tbl1', name: 'Companies', fields: [] }] })
    const byName = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })
    const missing = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Missing',
      interPageDelayMs: 0,
    })

    await expect(byName.describeSchema()).resolves.toEqual({
      columns: [{ name: 'airtable_id', sourceType: 'string' }],
    })
    await expect(missing.describeSchema()).rejects.toThrow('Airtable table "Missing" was not found')
  })

  it('waits the default 30-second cooldown before retrying a 429 response', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce({ records: [] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    const pagePromise = adapter.pull()
    await vi.advanceTimersByTimeAsync(29_999)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(pagePromise).resolves.toEqual({ rows: [], cursor: null, done: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-rate-limit 4xx response', async () => {
    const error = Object.assign(new Error('not found'), { status: 404 })
    const request = vi.fn().mockRejectedValue(error)
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    await expect(adapter.pull()).rejects.toBe(error)
    expect(request).toHaveBeenCalledOnce()
  })

  it('retries a 5xx response once after the default one-second delay', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('server error'), { status: 500 }))
      .mockResolvedValueOnce({ records: [] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    const pagePromise = adapter.pull()
    await vi.advanceTimersByTimeAsync(999)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(pagePromise).resolves.toEqual({ rows: [], cursor: null, done: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('honors retryAfterMs before the status-specific default delay', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429, retryAfterMs: 2500 }))
      .mockResolvedValueOnce({ records: [] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    const pagePromise = adapter.pull()
    await vi.advanceTimersByTimeAsync(2499)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(pagePromise).resolves.toEqual({ rows: [], cursor: null, done: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('treats an error without a status as transient and retries after one second', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ records: [] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
    })

    const pagePromise = adapter.pull()
    await vi.advanceTimersByTimeAsync(999)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(pagePromise).resolves.toEqual({ rows: [], cursor: null, done: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('rethrows after configurable retries are exhausted', async () => {
    vi.useFakeTimers()
    const error = Object.assign(new Error('still rate limited'), { status: 429 })
    const request = vi.fn().mockRejectedValue(error)
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
      interPageDelayMs: 0,
      maxRetries: 1,
    })

    const pagePromise = adapter.pull()
    const rejection = expect(pagePromise).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(30_000)

    await rejection
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('honors the default delay between successive requests', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockResolvedValueOnce({ records: [], offset: 'next' })
      .mockResolvedValueOnce({ records: [] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'Companies',
    })

    const first = await adapter.pull()
    const secondPromise = adapter.pull(first.cursor ?? undefined)
    await vi.advanceTimersByTimeAsync(209)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(secondPromise).resolves.toEqual({ rows: [], cursor: null, done: true })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('is not snapshot-consistent so the engine refuses destructive deletion', () => {
    const adapter = new AirtableSyncAdapter({
      client: createMockClient(),
      baseId: 'appBase',
      table: 'Companies',
    })

    expect(adapter.id).toBe('airtable:appBase/Companies')
    expect(adapter.capabilities).toEqual({ snapshotConsistent: false })
    expect(() => new SyncEngine(adapter, { upsert: vi.fn() }, {
      externalIdField: 'airtable_id',
      deletionPolicy: 'delete',
    })).toThrow("deletionPolicy 'delete' requires a snapshot-consistent adapter")
  })
})
