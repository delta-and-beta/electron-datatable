import type { ReactNode } from 'react'

/** Any record shape — consumers define their own */
export type RowData = Record<string, unknown>

/** Date bucketing period for group-by */
export type DatePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** Column definition — tells the table how to render and group each field */
export interface ColumnDef<T extends RowData = RowData> {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'currency' | 'custom'

  // Display
  render?: (value: unknown, row: T) => ReactNode
  headerRender?: () => ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'

  // Behavior
  sortable?: boolean
  groupable?: boolean
  searchable?: boolean
  visible?: boolean
  filterable?: boolean
  /** Predefined value choices (e.g. a single-select field). When set, the filter
   *  renders a value dropdown (Airtable-style) instead of a free-text input. */
  options?: Array<string | { value: string; label?: string }>

  // Grouping
  datePeriods?: DatePeriod[]
  sumInGroup?: boolean

  // Formatting
  format?: (value: unknown) => string
  currency?: string
}

/** A single grouping level */
export interface GroupLevel {
  field: string
  sort: 'asc' | 'desc'
  datePeriod?: DatePeriod
}

/** Full grouping configuration (persisted to localStorage) */
export interface GroupConfig {
  groups: GroupLevel[]
  collapsed: string[]
  showEmpty: boolean
}

/** Result of grouping — recursive tree structure */
export interface GroupedSection {
  key: string
  field: string
  fieldLabel: string
  level: number
  count: number
  sums: Record<string, number>
  records: RowData[]
  subgroups: GroupedSection[]
}

/** Filter operators for text columns */
export type TextOperator = 'is' | 'is_not' | 'contains' | 'does_not_contain' | 'is_empty' | 'is_not_empty'

/** Filter operators for number/currency columns */
export type NumberOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty'

/** Filter operators for date columns */
export type DateOperator = 'is' | 'is_before' | 'is_after' | 'is_on_or_before' | 'is_on_or_after' | 'is_empty' | 'is_not_empty'

/** Union of all filter operators */
export type FilterOperator = TextOperator | NumberOperator | DateOperator

/** A single filter condition: field + operator + value */
export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
}

/** A group of conditions joined by a single conjunction, with optional nested sub-groups */
export interface FilterGroup {
  id: string
  conjunction: 'and' | 'or'
  conditions: FilterCondition[]
  groups: FilterGroup[]
}

/** Root filter configuration (persisted to localStorage) */
export interface FilterConfig {
  root: FilterGroup
  enabled: boolean
}

/** Attachment adapter — consumers implement for their storage backend */
export interface AttachmentAdapter {
  add(rowId: string, filename: string, mimeType: string, dataBase64: string): Promise<Attachment>
  list(rowId: string): Promise<Attachment[]>
  delete(attachmentId: string): Promise<void>
  getCounts(rowIds: string[]): Promise<Record<string, number>>
}

/** A single attachment record */
export interface Attachment {
  id: string
  filename: string
  mimeType: string
  createdAt: string
}

/** Props for the root DataTable component */
export interface DataTableProps<T extends RowData = RowData> {
  data: T[]
  columns: ColumnDef<T>[]
  rowKey: keyof T & string
  storageKey?: string
  preset?: 'full' | 'minimal' | 'none'
  attachmentAdapter?: AttachmentAdapter
  defaultSort?: { field: string; direction: 'asc' | 'desc' }
  defaultGroupBy?: GroupLevel[]
  onRowClick?: (row: T) => void
  onRowContextMenu?: (row: T, event: React.MouseEvent) => void
  onAttachmentClick?: (rowId: string, event: React.MouseEvent) => void
  toolbarExtra?: ReactNode
  className?: string
  children?: ReactNode
}
