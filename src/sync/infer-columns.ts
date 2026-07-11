import type { ColumnDef } from '../types'
import type { SourceSchema } from './types'

const numericTypes = /^(?:tinyint|smallint|mediumint|int|integer|bigint|numeric|real|float|double|decimal)\b/i
const dateTypes = /^(?:date|timestamp|datetime|time)\b/i
const booleanTypes = /^(?:bool|boolean)\b/i
const customTypes = /^(?:json|jsonb|struct)\b/i

function inferType(sourceType: string): ColumnDef['type'] {
  const normalized = sourceType.trim()
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
    const inferred: ColumnDef = {
      id: column.name,
      label: column.name,
      type: inferType(column.sourceType),
    }

    if (booleanTypes.test(column.sourceType.trim())) {
      inferred.options = ['true', 'false']
    }

    return { ...inferred, ...overrides[column.name] }
  })
}
