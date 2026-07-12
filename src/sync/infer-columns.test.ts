import { describe, expect, it } from 'vitest'
import { inferColumns } from './infer-columns'

describe('inferColumns', () => {
  it.each([
    ['text', 'text'],
    ['VARCHAR(255)', 'text'],
    ['char', 'text'],
    ['string', 'text'],
    ['int', 'number'],
    ['INTEGER', 'number'],
    ['bigint', 'number'],
    ['numeric', 'number'],
    ['real', 'number'],
    ['float', 'number'],
    ['double precision', 'number'],
    ['decimal(10,2)', 'number'],
    ['date', 'date'],
    ['timestamp with time zone', 'date'],
    ['datetime', 'date'],
    ['time', 'date'],
    ['json', 'custom'],
    ['jsonb', 'custom'],
    ['struct', 'custom'],
    ['custom', 'custom'],
    ['tags', 'tags'],
    ['unknown_vendor_type', 'text'],
  ] as const)('maps %s to %s', (sourceType, type) => {
    expect(inferColumns({ columns: [{ name: 'value', sourceType }] })).toEqual([
      expect.objectContaining({ id: 'value', label: 'value', type }),
    ])
  })

  it.each(['bool', 'boolean'])('maps %s to text with boolean options', (sourceType) => {
    expect(inferColumns({ columns: [{ name: 'enabled', sourceType }] })).toEqual([
      expect.objectContaining({
        id: 'enabled',
        label: 'enabled',
        type: 'text',
        options: ['true', 'false'],
      }),
    ])
  })

  it('applies overrides and never infers currency without one', () => {
    const schema = { columns: [{ name: 'amount_cents', sourceType: 'integer' }] }

    expect(inferColumns(schema)[0].type).toBe('number')
    expect(inferColumns(schema, {
      amount_cents: { type: 'currency', minorUnits: true, currency: 'USD' },
    })[0]).toEqual(expect.objectContaining({
      id: 'amount_cents',
      type: 'currency',
      minorUnits: true,
      currency: 'USD',
    }))
  })

  it('retains source writability and prevents non-writable columns from being made editable', () => {
    const schema = { columns: [{
      name: 'Score',
      sourceType: 'number',
      writable: false,
      fieldKind: 'formula',
    }] }

    expect(inferColumns(schema, { Score: { editable: true } })).toEqual([expect.objectContaining({
      id: 'Score',
      editable: false,
      meta: { fieldKind: 'formula', writable: false },
    })])
  })

  it('retains writable metadata for writable source columns', () => {
    expect(inferColumns({
      columns: [{ name: 'Name', sourceType: 'string', writable: true }],
    })[0]).toEqual(expect.objectContaining({
      meta: { writable: true },
    }))
  })

  it('changing display type cannot make a non-writable source column editable', () => {
    expect(inferColumns({
      columns: [{ name: 'Computed', sourceType: 'number', writable: false }],
    }, {
      Computed: { type: 'currency', editable: true },
    })[0]).toEqual(expect.objectContaining({
      type: 'currency',
      editable: false,
      meta: { writable: false },
    }))
  })

  it('does not let overrides rewrite source writability or unlock resolved non-writable metadata', () => {
    expect(inferColumns({
      columns: [{ name: 'Computed', sourceType: 'number', writable: false }],
    }, {
      Computed: { editable: true, meta: { writable: true } },
    })[0]).toEqual(expect.objectContaining({
      editable: false,
      meta: { writable: false },
    }))

    expect(inferColumns({
      columns: [{ name: 'LocallyLocked', sourceType: 'string' }],
    }, {
      LocallyLocked: { editable: true, meta: { writable: false } },
    })[0]).toEqual(expect.objectContaining({
      editable: false,
      meta: { writable: false },
    }))
  })

  it('marks inferred booleans so editors commit boolean values', () => {
    expect(inferColumns({ columns: [{ name: 'enabled', sourceType: 'boolean' }] })).toEqual([
      expect.objectContaining({
        id: 'enabled',
        options: ['true', 'false'],
        meta: { fieldKind: 'boolean' },
      }),
    ])
  })

  it('carries source schema option names into inferred editors', () => {
    expect(inferColumns({ columns: [{
      name: 'Stage',
      sourceType: 'string',
      fieldKind: 'singleSelect',
      metadata: { options: ['Open', 'Won'] },
    }] })).toEqual([expect.objectContaining({
      id: 'Stage',
      options: ['Open', 'Won'],
    })])
  })
})
