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

/** Attachment adapter — consumers implement for their storage backend */
export interface AttachmentAdapter {
  add(rowId: string, file: File): Promise<Attachment>
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
  className?: string
  children?: ReactNode
}
