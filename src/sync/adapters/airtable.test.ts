import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncEngine } from '../engine'
import { inferColumns } from '../infer-columns'
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
  it('reports push support only when the client can send a request body', () => {
    const readOnly = new AirtableSyncAdapter({
      client: createMockClient(),
      baseId: 'appBase',
      table: 'Companies',
    })
    const writable = new AirtableSyncAdapter({
      client: createMockClient({ requestWithBody: vi.fn() }),
      baseId: 'appBase',
      table: 'Companies',
    })

    expect(readOnly.capabilities.canPush).toBe(false)
    expect(writable.capabilities.canPush).toBe(true)
    expect(writable.pushBatchSize).toBe(10)
  })

  it('loads schema on a cold push, drops computed fields, and defaults typecast off', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'Score', type: 'formula' },
      ],
    }] })
    const requestWithBody = vi.fn().mockResolvedValue({ records: [
      { id: 'rec1', fields: { Name: 'Updated' } },
    ] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([{ externalId: 'rec1', fields: {
      airtable_id: 'must-not-leak',
      Name: 'Updated',
      Score: 99,
    } }])).resolves.toEqual([{ externalId: 'rec1', ok: true }])
    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith('meta/bases/appBase/tables')
    expect(request.mock.invocationCallOrder[0]).toBeLessThan(requestWithBody.mock.invocationCallOrder[0])
    expect(requestWithBody).toHaveBeenCalledWith('PATCH', 'appBase/tblCompanies', {
      records: [{ id: 'rec1', fields: { Name: 'Updated' } }],
      typecast: false,
    })
  })

  it('never sends fields whose schema entry or field kind is unknown', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'Mystery', type: 'futureFieldType' },
      ],
    }] })
    const requestWithBody = vi.fn().mockResolvedValue({ records: [{ id: 'rec1', fields: {} }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([{ externalId: 'rec1', fields: {
      Name: 'Updated',
      Mystery: 'not-safe',
      NotInSchema: 'not-safe',
    } }])).resolves.toEqual([{ externalId: 'rec1', ok: true }])

    expect(requestWithBody).toHaveBeenCalledWith('PATCH', 'appBase/tblCompanies', {
      records: [{ id: 'rec1', fields: { Name: 'Updated' } }],
      typecast: false,
    })
  })

  it.each([
    ['Tags', 'multipleSelects', 'Gold'],
    ['Stage', 'singleSelect', ['Won']],
  ])('rejects wrong-shaped %s values per record without sending them', async (field, fieldKind, value) => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: field, type: fieldKind, options: { choices: [{ name: 'Won' }, { name: 'Gold' }] } },
      ],
    }] })
    const requestWithBody = vi.fn().mockResolvedValue({ records: [{ id: 'recGood', fields: {} }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })
    const results = await adapter.push([
      { externalId: 'recBad', fields: { [field]: value } },
      { externalId: 'recGood', fields: { Name: 'Safe' } },
    ])

    expect(results).toEqual([
      { externalId: 'recBad', ok: false, error: expect.stringContaining(`${field} has`) },
      { externalId: 'recGood', ok: true },
    ])
    expect(requestWithBody).toHaveBeenCalledOnce()
    expect(requestWithBody).toHaveBeenCalledWith('PATCH', 'appBase/tblCompanies', {
      records: [{ id: 'recGood', fields: { Name: 'Safe' } }],
      typecast: false,
    })
  })

  it.each([
    ['singleSelect', 'New option'],
    ['multipleSelects', ['Won', 'New option']],
  ])('rejects a new %s option on a cold push without writing', async (fieldKind, value) => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Stage', type: fieldKind, options: { choices: [{ name: 'Open' }, { name: 'Won' }] } },
      ],
    }] })
    const requestWithBody = vi.fn()
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([{ externalId: 'rec1', fields: { Stage: value } }]))
      .resolves.toEqual([{
        externalId: 'rec1',
        ok: false,
        error: 'value is not an existing option for Stage',
      }])
    expect(requestWithBody).not.toHaveBeenCalled()
  })

  it('sends existing single- and multiple-select options on a cold push with typecast disabled', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Stage', type: 'singleSelect', options: { choices: [{ name: 'Open' }, { name: 'Won' }] } },
        { name: 'Tags', type: 'multipleSelects', options: { choices: [{ name: 'Gold' }, { name: 'Priority' }] } },
      ],
    }] })
    const requestWithBody = vi.fn().mockResolvedValue({ records: [{ id: 'rec1', fields: {} }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([{ externalId: 'rec1', fields: {
      Stage: 'Won',
      Tags: ['Gold', 'Priority'],
    } }]))
      .resolves.toEqual([{ externalId: 'rec1', ok: true }])

    expect(requestWithBody).toHaveBeenCalledWith('PATCH', 'appBase/tblCompanies', {
      records: [{ id: 'rec1', fields: { Stage: 'Won', Tags: ['Gold', 'Priority'] } }],
      typecast: false,
    })
  })

  it('validates collaborator shapes and keeps typecast disabled', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Owner', type: 'singleCollaborator' },
        { name: 'Reviewers', type: 'multipleCollaborators' },
      ],
    }] })
    const requestWithBody = vi.fn().mockResolvedValue({ records: [{ id: 'recGood', fields: {} }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([
      { externalId: 'recBad', fields: { Owner: 'usr1' } },
      {
        externalId: 'recGood',
        fields: { Owner: { id: 'usr1' }, Reviewers: [{ id: 'usr2' }] },
      },
    ])).resolves.toEqual([
      {
        externalId: 'recBad',
        ok: false,
        error: 'Owner has an invalid value shape for Airtable singleCollaborator',
      },
      { externalId: 'recGood', ok: true },
    ])
    expect(requestWithBody).toHaveBeenCalledWith('PATCH', 'appBase/tblCompanies', {
      records: [{
        id: 'recGood',
        fields: { Owner: { id: 'usr1' }, Reviewers: [{ id: 'usr2' }] },
      }],
      typecast: false,
    })
  })

  it('fails every record closed when cold-push schema loading fails', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('Meta unavailable'), { status: 403 }))
    const requestWithBody = vi.fn()
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([
      { externalId: 'rec1', fields: { Name: 'One' } },
      { externalId: 'rec2', fields: { Name: 'Two' } },
    ])).resolves.toEqual([
      { externalId: 'rec1', ok: false, error: 'Airtable schema load failed: Meta unavailable' },
      { externalId: 'rec2', ok: false, error: 'Airtable schema load failed: Meta unavailable' },
    ])
    expect(requestWithBody).not.toHaveBeenCalled()
  })

  it('marks record-link columns non-writable and never pushes them', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [{ name: 'Owner', type: 'multipleRecordLinks' }],
    }] })
    const requestWithBody = vi.fn()
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.push([{ externalId: 'rec1', fields: { Owner: ['recOwner'] } }]))
      .resolves.toEqual([{ externalId: 'rec1', ok: true }])
    expect(requestWithBody).not.toHaveBeenCalled()
    await expect(adapter.describeSchema()).resolves.toEqual({
      columns: [
        { name: 'airtable_id', sourceType: 'string', writable: false, fieldKind: 'recordId' },
        { name: 'Owner', sourceType: 'tags', writable: false, fieldKind: 'multipleRecordLinks' },
      ],
    })
    expect(request).toHaveBeenCalledOnce()
    expect(inferColumns(await adapter.describeSchema(), { Owner: { editable: true } }))
      .toContainEqual(expect.objectContaining({ id: 'Owner', editable: false }))
    expect(request).toHaveBeenCalledOnce()
  })

  it('retries a rejected batch as individual records to isolate a 422 offender', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [{ name: 'Name', type: 'singleLineText' }],
    }] })
    const requestWithBody = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('invalid request'), { status: 422 }))
      .mockResolvedValueOnce({ records: [{ id: 'recGood', fields: { Name: 'Good' } }] })
      .mockRejectedValueOnce(Object.assign(new Error('unprocessable entity'), {
        status: 422,
        response: { error: { message: 'Name cannot be blank' } },
      }))
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    const results = await adapter.push([
      { externalId: 'recGood', fields: { Name: 'Good' } },
      { externalId: 'recBad', fields: { Name: '' } },
    ])

    expect(results).toEqual([
      { externalId: 'recGood', ok: true },
      { externalId: 'recBad', ok: false, error: 'Name cannot be blank' },
    ])
    expect(requestWithBody).toHaveBeenCalledTimes(3)
    expect(requestWithBody.mock.calls[1][2].records).toHaveLength(1)
    expect(requestWithBody.mock.calls[2][2].records).toHaveLength(1)
  })

  it('honors the rate-limit cooldown when pushing', async () => {
    vi.useFakeTimers()
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [{ name: 'Name', type: 'singleLineText' }],
    }] })
    const requestWithBody = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce({ records: [{ id: 'rec1', fields: {} }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request, requestWithBody }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
      rateLimitDelayMs: 500,
    })

    const pushPromise = adapter.push([{ externalId: 'rec1', fields: { Name: 'One' } }])
    await vi.advanceTimersByTimeAsync(499)
    expect(requestWithBody).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)

    await expect(pushPromise).resolves.toEqual([{ externalId: 'rec1', ok: true }])
    expect(requestWithBody).toHaveBeenCalledTimes(2)
  })

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
      ['currency', 'currency'],
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
      ['count', 'custom'],
      ['createdBy', 'custom'],
      ['lastModifiedBy', 'custom'],
      ['barcode', 'custom'],
      ['button', 'custom'],
      ['multipleAttachments', 'custom'],
      ['futureFieldType', 'custom'],
    ] as const
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: fields.map(([type], index) => ({
        name: `Field ${index}`,
        type,
        ...(type === 'currency' ? { options: { symbol: '$', precision: 2 } } : {}),
      })),
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
      { name: 'airtable_id', sourceType: 'string', writable: false, fieldKind: 'recordId' },
      ...fields.map(([fieldKind, sourceType], index) => ({
        name: `Field ${index}`,
        sourceType,
        fieldKind,
        writable: ![
          'formula',
          'rollup',
          'count',
          'autoNumber',
          'createdTime',
          'lastModifiedTime',
          'createdBy',
          'lastModifiedBy',
          'multipleLookupValues',
          'multipleRecordLinks',
          'button',
          'futureFieldType',
        ].includes(fieldKind),
        ...(sourceType === 'currency'
          ? {
              metadata: {
                symbol: '$',
                precision: 2,
                airtableOptions: { symbol: '$', precision: 2 },
              },
            }
          : {}),
      })),
    ])
  })

  it('retains Airtable field identity, description, and raw options in source metadata', async () => {
    const airtableOptions = {
      choices: [{ id: 'selLead', name: 'Lead', color: 'blueLight' }],
    }
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [{
        id: 'fldStage',
        name: 'Stage',
        description: 'Current pipeline stage',
        type: 'singleSelect',
        options: airtableOptions,
      }],
    }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    const schema = await adapter.describeSchema()

    expect(schema.columns).toContainEqual({
      name: 'Stage',
      sourceType: 'string',
      fieldKind: 'singleSelect',
      writable: true,
      metadata: {
        fieldId: 'fldStage',
        description: 'Current pipeline stage',
        options: ['Lead'],
        airtableOptions,
      },
    })
  })

  it('marks computed barcode metadata as non-writable', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [{ name: 'Generated barcode', type: 'barcode', isComputed: true }],
    }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    await expect(adapter.describeSchema()).resolves.toEqual({
      columns: [
        { name: 'airtable_id', sourceType: 'string', writable: false, fieldKind: 'recordId' },
        {
          name: 'Generated barcode',
          sourceType: 'custom',
          writable: false,
          fieldKind: 'barcode',
        },
      ],
    })
  })

  it('carries Airtable currency metadata through inferred column formatting', async () => {
    const request = vi.fn().mockResolvedValue({ tables: [{
      id: 'tblCompanies',
      name: 'Companies',
      fields: [
        { name: 'Budget', type: 'currency', options: { symbol: 'HK$', precision: 3 } },
        { name: 'Margin', type: 'percent', options: { precision: 1 } },
      ],
    }] })
    const adapter = new AirtableSyncAdapter({
      client: createMockClient({ request }),
      baseId: 'appBase',
      table: 'tblCompanies',
      interPageDelayMs: 0,
    })

    const schema = await adapter.describeSchema()

    expect(schema.columns).toContainEqual({
      name: 'Budget',
      sourceType: 'currency',
      fieldKind: 'currency',
      writable: true,
      metadata: {
        symbol: 'HK$',
        precision: 3,
        airtableOptions: { symbol: 'HK$', precision: 3 },
      },
    })
    expect(inferColumns(schema)).toContainEqual(expect.objectContaining({
      id: 'Budget',
      type: 'currency',
      symbol: 'HK$',
      decimalPlaces: 3,
      minorUnits: false,
    }))
    expect(inferColumns(schema)).toContainEqual(expect.objectContaining({
      id: 'Margin',
      type: 'number',
    }))
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
      columns: [{
        name: 'airtable_id',
        sourceType: 'string',
        fieldKind: 'recordId',
        writable: false,
      }],
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
    expect(adapter.capabilities).toEqual({ snapshotConsistent: false, canPush: false })
    expect(() => new SyncEngine(adapter, { upsert: vi.fn() }, {
      externalIdField: 'airtable_id',
      deletionPolicy: 'delete',
    })).toThrow("deletionPolicy 'delete' requires a snapshot-consistent adapter")
  })
})
