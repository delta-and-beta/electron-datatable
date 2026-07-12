import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, EyeOff, Filter, Layers3, Pin } from 'lucide-react'
import type { ColumnDef, ColumnMenuItem, RowData } from '../types'
import { useDataTable } from '../context'
import { MenuItem } from './MenuItem'
import { Popover } from './Popover'

export interface ColumnHeaderMenuProps<T extends object = RowData> {
  column: ColumnDef<T>
  visibleIndex: number
}

function Divider() {
  return <div role="separator" aria-orientation="horizontal" className="my-1 border-t border-dt-border" />
}

export function ColumnHeaderMenu<T extends object = RowData>({
  column,
  visibleIndex,
}: ColumnHeaderMenuProps<T>) {
  const {
    sort,
    filter,
    groupBy,
    columnState,
    columnMenuItems,
    openFilterPanel,
  } = useDataTable<T>()
  const [open, setOpen] = useState(false)
  const sortable = column.sortable !== false
  const filterable = column.filterable !== false
  const groupingReason = column.type === 'tags'
    ? 'Tag fields cannot be grouped'
    : column.groupable === false
      ? 'Grouping is disabled for this field'
      : groupBy.levels.length >= 3
        ? 'Only 3 group levels are supported'
        : undefined
  const consumerItems = columnMenuItems?.(column) ?? []

  function select(action: () => void) {
    action()
    setOpen(false)
  }

  const builtIns: ColumnMenuItem[] = [
    {
      key: 'sort-asc',
      label: 'Sort A→Z',
      icon: <ArrowUp />,
      onSelect: () => sort.setSort(column.id, 'asc'),
      disabled: !sortable,
      disabledReason: !sortable ? 'Sorting is disabled for this field' : undefined,
    },
    {
      key: 'sort-desc',
      label: 'Sort Z→A',
      icon: <ArrowDown />,
      onSelect: () => sort.setSort(column.id, 'desc'),
      disabled: !sortable,
      disabledReason: !sortable ? 'Sorting is disabled for this field' : undefined,
    },
    {
      key: 'filter',
      label: 'Filter by this field',
      icon: <Filter />,
      onSelect: () => {
        filter.addCondition(filter.root.id, column.id)
        openFilterPanel()
      },
      disabled: !filterable,
      disabledReason: !filterable ? 'Filtering is disabled for this field' : undefined,
    },
    {
      key: 'group',
      label: 'Group by this field',
      icon: <Layers3 />,
      onSelect: () => groupBy.addGroup(column.id),
      disabled: groupingReason !== undefined,
      disabledReason: groupingReason,
    },
    {
      key: 'freeze',
      label: 'Freeze up to here',
      icon: <Pin />,
      onSelect: () => columnState.setFrozenColumns(visibleIndex + 1),
    },
    {
      key: 'hide',
      label: 'Hide field',
      icon: <EyeOff />,
      onSelect: () => columnState.setColumnVisibility(column.id, false),
    },
  ]

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      aria-label={`${column.label} field menu`}
      contentClassName="w-56"
      trigger={(
        <button
          type="button"
          aria-label={`Open menu for ${column.label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onMouseDown={(event) => event.stopPropagation()}
          className="absolute right-1.5 top-1/2 z-10 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-dt-muted opacity-0 transition-opacity hover:bg-dt-bg-secondary hover:text-dt-text focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dt-primary/60 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    >
      <div className="p-1 text-dt-text">
        {builtIns.map((item) => (
          <MenuItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            onSelect={() => select(item.onSelect)}
            disabled={item.disabled}
            disabledReason={item.disabledReason}
          />
        ))}
        {consumerItems.length > 0 ? <Divider /> : null}
        {consumerItems.map((item) => (
          <div key={item.key}>
            {item.separatorBefore ? <Divider /> : null}
            <MenuItem
              icon={item.icon}
              label={item.label}
              onSelect={() => select(item.onSelect)}
              variant={item.variant}
              disabled={item.disabled}
              disabledReason={item.disabledReason}
            />
          </div>
        ))}
      </div>
    </Popover>
  )
}

ColumnHeaderMenu.displayName = 'ColumnHeaderMenu'
