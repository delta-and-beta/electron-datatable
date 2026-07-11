import type { ReactNode } from 'react'
import type { BadgeVariant } from './components/StatusBadge'
import type { FooterKpi } from './components/Footer'

/** @deprecated Use your domain row type directly instead */
export type RowData = Record<string, unknown>

/** An icon-button action rendered for each table row */
export type RowAction<T extends object> = {
  key: string
  title: string
  icon?: ReactNode
  onClick: (row: T) => void
  show?: (row: T) => boolean
  variant?: 'default' | 'danger'
}

/** Date bucketing period for group-by */
export type DatePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** Column definition — tells the table how to render and group each field */
export interface ColumnDef<T extends object = RowData> {
  id: string
  label: string
  /**
   * `tags` values are `string[]`. Consumers with object arrays should map them
   * to labels in their accessor or `render`. Tags sort by array length, then
   * first label, and cannot be grouped.
   */
  type: 'text' | 'number' | 'date' | 'currency' | 'custom' | 'tags'

  // Display
  render?: (value: unknown, row: T) => ReactNode
  headerRender?: () => ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
  badgeVariants?: Record<string, BadgeVariant>

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
  /** Value is stored in minor units (for example, cents) */
  minorUnits?: boolean
  /** Number of decimal places to display and use for minor-unit conversion */
  decimalPlaces?: number
  /** Literal currency symbol or prefix override */
  symbol?: string
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
export interface GroupedSection<T extends object = RowData> {
  key: string
  field: string
  fieldLabel: string
  level: number
  count: number
  sums: Record<string, number>
  records: T[]
  subgroups: GroupedSection<T>[]
}

/** Card and lane configuration for the kanban view */
export interface KanbanConfig<T extends object = RowData> {
  laneField?: string
  laneOrder?: string[]
  card: {
    titleField: string
    subtitleField?: string
    footerFields?: string[]
    render?: (row: T) => ReactNode
  }
  laneAggregate?: {
    field: string
    label?: string
  }
  allowMove?: boolean
  onMove?: (rowKey: string, toLane: string) => void | Promise<void>
}

/** Filter operators for text columns */
export type TextOperator = 'is' | 'is_not' | 'contains' | 'does_not_contain' | 'is_empty' | 'is_not_empty'

/** Filter operators for number/currency columns */
export type NumberOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty'

/** Filter operators for date columns */
export type DateOperator = 'is' | 'is_before' | 'is_after' | 'is_on_or_before' | 'is_on_or_after' | 'is_empty' | 'is_not_empty'

/** Filter operators for tags columns */
export type TagsOperator = 'contains_any' | 'contains_all' | 'is_empty' | 'is_not_empty'

/** Union of all filter operators */
export type FilterOperator = TextOperator | NumberOperator | DateOperator | TagsOperator

/** A single filter condition: field + operator + value */
export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string | string[]
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
export interface DataTableProps<T extends object = RowData> {
  data: T[]
  columns: ColumnDef<T>[]
  actions?: RowAction<T>[]
  rowKey: keyof T & string
  storageKey?: string
  /** Number of leading visible data columns kept fixed during horizontal scroll */
  frozenColumns?: number
  preset?: 'full' | 'minimal' | 'none'
  attachmentAdapter?: AttachmentAdapter
  defaultSort?: { field: string; direction: 'asc' | 'desc' }
  defaultGroupBy?: GroupLevel[]
  kanban?: KanbanConfig<T>
  viewMode?: 'table' | 'kanban'
  onViewModeChange?: (viewMode: 'table' | 'kanban') => void
  onRowClick?: (row: T) => void
  onRowContextMenu?: (row: T, event: React.MouseEvent) => void
  toolbarExtra?: ReactNode
  footerKpis?: FooterKpi[]
  className?: string
  children?: ReactNode
}
