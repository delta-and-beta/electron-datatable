import type { ColumnDef } from '../types'
import type { SourceColumnType, SourceSchema } from './types'

const numericTypes = /^(?:tinyint|smallint|mediumint|int|integer|bigint|numeric|real|float|double|decimal)\b/i
const dateTypes = /^(?:date|timestamp|datetime|time)\b/i
const booleanTypes = /^(?:bool|boolean)\b/i
const customTypes = /^(?:json|jsonb|struct)\b/i

const adapterTypeMap = {
  string: 'text',
  number: 'number',
  currency: 'currency',
  date: 'date',
  boolean: 'text',
  tags: 'tags',
  custom: 'custom',
  null: 'text',
  binary: 'text',
  unknown: 'text',
} satisfies Record<SourceColumnType, ColumnDef['type']>

function isSourceColumnType(value: string): value is SourceColumnType {
  return value in adapterTypeMap
}

function inferType(sourceType: string): ColumnDef['type'] {
  const normalized = sourceType.trim()
  if (isSourceColumnType(normalized)) return adapterTypeMap[normalized]
  if (numericTypes.test(normalized)) return 'number'
  if (dateTypes.test(normalized)) return 'date'
  if (customTypes.test(normalized)) return 'custom'
  return 'text'
}

export function inferColumns(
  schema: SourceSchema,
  overrides: Record<string, Partial<ColumnDef>> = {},
): ColumnDef[] {
  return schema.columns.map((column) => {
    const normalizedSourceType = column.sourceType.trim()
    const inferredFieldKind = column.fieldKind
      ?? (booleanTypes.test(normalizedSourceType) || normalizedSourceType === 'boolean'
        ? 'boolean'
        : undefined)
    const inferredMeta = {
      ...(inferredFieldKind === undefined ? {} : { fieldKind: inferredFieldKind }),
      ...(column.writable === undefined ? {} : { writable: column.writable }),
    }
    const inferred: ColumnDef = {
      id: column.name,
      label: column.name,
      type: inferType(column.sourceType),
      ...(Object.keys(inferredMeta).length === 0 ? {} : { meta: inferredMeta }),
    }

    if (booleanTypes.test(normalizedSourceType) || normalizedSourceType === 'boolean') {
      inferred.options = ['true', 'false']
    }
    if (column.metadata?.options !== undefined) {
      inferred.options = column.metadata.options
    }

    if (column.sourceType.trim() === 'currency') {
      inferred.symbol = column.metadata?.symbol
      inferred.decimalPlaces = column.metadata?.precision ?? 2
      inferred.minorUnits = false
    }

    const override = overrides[column.name]
    const resolved = {
      ...inferred,
      ...override,
      ...(inferred.meta === undefined && override?.meta === undefined
        ? {}
        : { meta: { ...inferred.meta, ...override?.meta } }),
    }
    if (column.writable !== undefined) {
      resolved.meta = { ...resolved.meta, writable: column.writable }
    }
    if (resolved.meta?.writable === false) resolved.editable = false
    return resolved
  })
}
