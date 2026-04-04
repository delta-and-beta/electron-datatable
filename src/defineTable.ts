import type { RowData, ColumnDef, GroupLevel } from './types'

/** Column definition using object key as field ID */
type ColumnConfig<T extends RowData> = Omit<ColumnDef<T>, 'id'>

/** Table configuration object */
interface TableConfig<T extends RowData> {
  rowKey: keyof T & string
  storageKey?: string
  columns: { [K in keyof T]?: ColumnConfig<T> }
  defaults?: {
    sort?: { field: keyof T & string; direction: 'asc' | 'desc' }
    groupBy?: GroupLevel[]
  }
}

/** Return type — spread directly onto <DataTable> */
interface TableDefinition<T extends RowData> {
  columns: ColumnDef<T>[]
  rowKey: keyof T & string
  storageKey?: string
  defaultSort?: { field: string; direction: 'asc' | 'desc' }
  defaultGroupBy?: GroupLevel[]
}

/**
 * Define a table configuration with type-safe column IDs.
 * Returns props that spread directly onto <DataTable>.
 *
 * @example
 * const table = defineTable<Invoice>({
 *   rowKey: 'id',
 *   storageKey: 'invoices',
 *   columns: {
 *     vendor: { label: 'Vendor', type: 'text' },
 *     amount: { label: 'Amount', type: 'currency', currency: 'USD' },
 *   },
 *   defaults: { sort: { field: 'date', direction: 'desc' } },
 * })
 *
 * <DataTable {...table} data={invoices} preset="full" />
 */
export function defineTable<T extends RowData>(config: TableConfig<T>): TableDefinition<T> {
  const columns: ColumnDef<T>[] = Object.entries(config.columns).map(
    ([id, col]) => ({ id, ...(col as ColumnConfig<T>) }),
  )

  return {
    columns,
    rowKey: config.rowKey,
    storageKey: config.storageKey,
    defaultSort: config.defaults?.sort
      ? { field: config.defaults.sort.field, direction: config.defaults.sort.direction }
      : undefined,
    defaultGroupBy: config.defaults?.groupBy,
  }
}

/**
 * Identity function for type-safe column definitions.
 * Provides autocomplete on column IDs tied to your data shape.
 *
 * @example
 * const columns = defineColumns<Invoice>([
 *   { id: 'vendor', label: 'Vendor', type: 'text' },
 *   { id: 'amount', label: 'Amount', type: 'currency', currency: 'USD' },
 * ])
 */
export function defineColumns<T extends RowData>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  return columns
}
