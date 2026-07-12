import { useLayoutEffect, useRef, useState } from 'react'
import type { ColumnDef, RowData } from '../types'
import { cn } from '../lib/utils'

interface InlineCellEditorProps<T extends object> {
  column: ColumnDef<T>
  value: unknown
  onCommit: (nextValue: unknown, moveNext: boolean) => void
  onCancel: () => void
}

function initialEditorValue<T extends object>(column: ColumnDef<T>, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (column.meta?.fieldKind === 'dateTime') {
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (column.type === 'date') return String(value).slice(0, 10)
  return String(value)
}

function typedEditorValue<T extends object>(column: ColumnDef<T>, value: string): unknown {
  if (column.type === 'number' || column.type === 'currency') {
    return value === '' ? null : Number(value)
  }
  if (column.meta?.fieldKind === 'dateTime') {
    return value === '' ? '' : new Date(value).toISOString()
  }
  if (column.meta?.fieldKind === 'boolean' || column.meta?.fieldKind === 'checkbox') {
    return value === 'true'
  }
  return value
}

function currencyPrefix<T extends object>(column: ColumnDef<T>): string {
  if (column.symbol !== undefined) return column.symbol
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: column.currency ?? 'USD',
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? '$'
  } catch {
    return column.currency ?? '$'
  }
}

export function InlineCellEditor<T extends object = RowData>({
  column,
  value,
  onCommit,
  onCancel,
}: InlineCellEditorProps<T>) {
  const [draft, setDraft] = useState(() => initialEditorValue(column, value))
  const editorRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const settledRef = useRef(false)

  useLayoutEffect(() => {
    editorRef.current?.focus()
    if (editorRef.current instanceof HTMLInputElement) editorRef.current.select()
  }, [])

  const commit = (moveNext: boolean) => {
    if (settledRef.current) return
    settledRef.current = true
    onCommit(typedEditorValue(column, draft), moveNext)
  }

  const cancel = () => {
    if (settledRef.current) return
    settledRef.current = true
    onCancel()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(false)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      commit(true)
    }
  }

  const editorClassName = cn(
    'h-full min-h-9 w-full min-w-0 border border-dt-primary bg-dt-bg px-3 text-dt-text outline-none ring-1 ring-dt-primary',
    (column.type === 'number' || column.type === 'currency') && 'text-right tabular-nums',
  )

  if (column.options) {
    return (
      <select
        ref={editorRef as React.RefObject<HTMLSelectElement>}
        aria-label={`Edit ${column.label}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(false)}
        onClick={(event) => event.stopPropagation()}
        className={editorClassName}
      >
        {column.options.map((option) => {
          const details = typeof option === 'string'
            ? { value: option, label: option }
            : { value: option.value, label: option.label ?? option.value }
          return <option key={details.value} value={details.value}>{details.label}</option>
        })}
      </select>
    )
  }

  const input = (
    <input
      ref={editorRef as React.RefObject<HTMLInputElement>}
      type={column.type === 'number' || column.type === 'currency'
        ? 'number'
        : column.type === 'date'
          ? column.meta?.fieldKind === 'dateTime' ? 'datetime-local' : 'date'
          : 'text'}
      step={column.type === 'number' || column.type === 'currency' ? 'any' : undefined}
      aria-label={`Edit ${column.label}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => commit(false)}
      onClick={(event) => event.stopPropagation()}
      className={cn(editorClassName, column.type === 'currency' && 'pl-10')}
    />
  )

  if (column.type !== 'currency') return input

  return (
    <div className="relative h-full w-full">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-dt-muted"
      >
        {currencyPrefix(column)}
      </span>
      {input}
    </div>
  )
}
