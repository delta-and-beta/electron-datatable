import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { useDataTable } from '../context'
import type { ColumnDef, GroupedSection, RowData } from '../types'
import { asRecord } from '../lib/as-record'
import { formatAggregateValue } from '../lib/format-aggregate'
import { cn } from '../lib/utils'
import { renderColumnValue } from './render-column-value'

const UNCATEGORIZED_KEY = '__dt_uncategorized__'
const UNCATEGORIZED_LABEL = 'Uncategorized'

interface Lane<T extends object> {
  key: string
  label: string
  records: T[]
  synthetic?: boolean
}

function optionDetails<T extends object>(column: ColumnDef<T> | undefined) {
  return (column?.options ?? []).map((option) => (
    typeof option === 'string'
      ? { value: option, label: option }
      : { value: option.value, label: option.label ?? option.value }
  ))
}

function laneRecords<T extends object>(sections: GroupedSection<T>[]): T[] {
  return sections.flatMap((section) => section.records)
}

export function KanbanBoard<T extends object = RowData>() {
  const { columns, groupBy, kanban, onRowClick, rowKey } = useDataTable<T>()
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [optimisticLanes, setOptimisticLanes] = useState<Record<string, string>>({})

  useEffect(() => {
    setOptimisticLanes((current) => {
      let next = current
      for (const section of groupBy.groupedData) {
        for (const row of laneRecords([section])) {
          const key = String(asRecord(row)[rowKey])
          if (current[key] !== section.key) continue
          if (next === current) next = { ...current }
          delete next[key]
        }
      }
      return next
    })
  }, [groupBy.groupedData, rowKey])

  const lanes = useMemo<Lane<T>[]>(() => {
    if (!kanban || groupBy.levels.length === 0) return []

    const laneField = groupBy.levels[0].field
    const laneColumn = columns.find((column) => column.id === laneField)
    const options = optionDetails(laneColumn)
    const configuredOrder = kanban.laneOrder
      ?? (options.length > 0 ? options.map((option) => option.value) : undefined)
    const derivedOrder = groupBy.groupedData
      .map((section) => section.key)
      .filter((key) => key !== '(Empty)')
    const order = configuredOrder ?? derivedOrder
    const labels = new Map(options.map((option) => [option.value, option.label]))
    const knownLanes = new Set(order)
    const recordsByLane = new Map(order.map((lane) => [lane, [] as T[]]))
    const uncategorized: T[] = []

    for (const section of groupBy.groupedData) {
      for (const row of laneRecords([section])) {
        const key = String(asRecord(row)[rowKey])
        const lane = optimisticLanes[key] ?? section.key
        const destination = recordsByLane.get(lane)
        if (destination && knownLanes.has(lane)) destination.push(row)
        else uncategorized.push(row)
      }
    }

    const result: Lane<T>[] = order.map((key) => ({
      key,
      label: labels.get(key) ?? key,
      records: recordsByLane.get(key) ?? [],
    }))
    if (uncategorized.length > 0) {
      result.push({
        key: UNCATEGORIZED_KEY,
        label: UNCATEGORIZED_LABEL,
        records: uncategorized,
        synthetic: true,
      })
    }
    return result
  }, [columns, groupBy.groupedData, groupBy.levels, kanban, optimisticLanes, rowKey])

  if (!kanban) return null

  const movable = kanban.allowMove !== false && kanban.onMove !== undefined

  function handleDrop(event: DragEvent<HTMLElement>, toLane: string) {
    event.preventDefault()
    setDragOverLane(null)
    setDraggingKey(null)
    if (!movable || !kanban?.onMove) return

    const key = event.dataTransfer.getData('text/plain')
    if (!key) return
    const hadPrevious = Object.prototype.hasOwnProperty.call(optimisticLanes, key)
    const previousLane = optimisticLanes[key]
    setOptimisticLanes((previous) => ({ ...previous, [key]: toLane }))

    const clearMove = () => {
      setOptimisticLanes((current) => {
        if (current[key] !== toLane) return current
        const next = { ...current }
        delete next[key]
        return next
      })
    }
    const rollbackMove = (error: unknown) => {
      setOptimisticLanes((current) => {
        if (current[key] !== toLane) return current
        const next = { ...current }
        if (hadPrevious) next[key] = previousLane
        else delete next[key]
        return next
      })
      kanban.onMoveError?.(error, key, toLane)
    }

    try {
      Promise.resolve(kanban.onMove(key, toLane)).then(clearMove, rollbackMove)
    } catch (error) {
      rollbackMove(error)
    }
  }

  function activateCard(event: KeyboardEvent, row: T) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onRowClick?.(row)
  }

  function renderField(row: T, field: string): ReactNode {
    const column = columns.find((candidate) => candidate.id === field)
    if (!column) return String(asRecord(row)[field] ?? '-')
    return renderColumnValue(column, asRecord(row)[field], row, true)
  }

  return (
    <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden bg-dt-bg text-dt-text">
      <div className="flex h-full min-w-max gap-3 p-4">
        {lanes.map((lane) => {
          const laneMovable = movable && !lane.synthetic
          const aggregateColumn = kanban.laneAggregate
            ? columns.find((column) => column.id === kanban.laneAggregate?.field)
            : undefined
          const aggregate = aggregateColumn && kanban.laneAggregate
            ? lane.records.reduce((sum, row) => {
                const value = Number(asRecord(row)[kanban.laneAggregate!.field])
                return sum + (Number.isNaN(value) ? 0 : value)
              }, 0)
            : undefined

          return (
            <section
              key={lane.key}
              role="region"
              aria-label={`${lane.label} lane`}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border bg-dt-bg',
                dragOverLane === lane.key
                  ? 'border-dt-text bg-dt-bg-secondary'
                  : 'border-dt-border',
              )}
              onDragOver={laneMovable ? (event) => {
                event.preventDefault()
                setDragOverLane(lane.key)
              } : undefined}
              onDragLeave={laneMovable ? () => {
                setDragOverLane((current) => current === lane.key ? null : current)
              } : undefined}
              onDrop={laneMovable ? (event) => handleDrop(event, lane.key) : undefined}
            >
              <header className="shrink-0 border-b border-dt-border px-3 py-2">
                <div className="truncate text-xs font-semibold">{lane.label}</div>
                <div className="text-[10px] tabular-nums text-dt-muted">
                  <span>{lane.records.length} {lane.records.length === 1 ? 'card' : 'cards'}</span>
                  {aggregateColumn && aggregate !== undefined && kanban.laneAggregate ? (
                    <span> · {kanban.laneAggregate.label ?? aggregateColumn.label}: {formatAggregateValue(aggregateColumn, aggregate)}</span>
                  ) : null}
                </div>
              </header>
              <div className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto p-2">
                {lane.records.map((row) => {
                  const record = asRecord(row)
                  const key = String(record[rowKey])
                  const title = String(record[kanban.card.titleField] ?? '-')
                  return (
                    <article
                      key={key}
                      role="button"
                      aria-label={title}
                      tabIndex={onRowClick ? 0 : -1}
                      draggable={movable}
                      onDragStart={movable ? (event) => {
                        event.dataTransfer.setData('text/plain', key)
                        setDraggingKey(key)
                      } : undefined}
                      onDragEnd={movable ? () => setDraggingKey(null) : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (event) => activateCard(event, row) : undefined}
                      className={cn(
                        'space-y-1.5 rounded-md border border-dt-border bg-dt-bg-secondary p-2.5 text-dt-text transition-opacity',
                        movable && 'cursor-grab active:cursor-grabbing',
                        draggingKey === key ? 'opacity-40' : 'opacity-100',
                      )}
                    >
                      {kanban.card.render ? kanban.card.render(row) : (
                        <>
                          <div className="truncate text-xs font-semibold">{title}</div>
                          {kanban.card.subtitleField ? (
                            <div className="truncate text-[11px] text-dt-muted">
                              {String(record[kanban.card.subtitleField] ?? '-')}
                            </div>
                          ) : null}
                          {kanban.card.footerFields && kanban.card.footerFields.length > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              {kanban.card.footerFields.map((field) => (
                                <span key={field}>{renderField(row, field)}</span>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

KanbanBoard.displayName = 'KanbanBoard'
