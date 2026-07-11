import type { ColumnDef, GroupLevel, KanbanConfig, RowAction } from './types'

/** Column definition using object key as field ID */
type ColumnConfig<T extends object> = Omit<ColumnDef<T>, 'id'>

/** Table configuration object */
interface TableConfig<T extends object> {
  rowKey: keyof T & string
  storageKey?: string
  frozenColumns?: number
  columns: { [K in keyof T]?: ColumnConfig<T> }
  actions?: RowAction<T>[]
  kanban?: KanbanConfig<T>
  viewMode?: 'table' | 'kanban'
  onViewModeChange?: (viewMode: 'table' | 'kanban') => void
  defaults?: {
    sort?: { field: keyof T & string; direction: 'asc' | 'desc' }
    groupBy?: GroupLevel[]
  }
}

/** Return type — spread directly onto <DataTable> */
interface TableDefinition<T extends object> {
  columns: ColumnDef<T>[]
  actions?: RowAction<T>[]
  kanban?: KanbanConfig<T>
  viewMode?: 'table' | 'kanban'
  onViewModeChange?: (viewMode: 'table' | 'kanban') => void
  rowKey: keyof T & string
  storageKey?: string
  frozenColumns?: number
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
export function defineTable<T extends object>(config: TableConfig<T>): TableDefinition<T> {
  const columns: ColumnDef<T>[] = Object.entries(config.columns).map(
    ([id, col]) => ({ id, ...(col as ColumnConfig<T>) }),
  )

  return {
    columns,
    actions: config.actions,
    kanban: config.kanban,
    viewMode: config.viewMode,
    onViewModeChange: config.onViewModeChange,
    rowKey: config.rowKey,
    storageKey: config.storageKey,
    frozenColumns: config.frozenColumns,
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
export function defineColumns<T extends object>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  return columns
}
