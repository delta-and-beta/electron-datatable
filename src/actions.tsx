import type { ColumnDef, RowAction } from './types'
import { cn } from './lib/utils'

export const ACTIONS_COLUMN_ID = '__dt_internal_actions'

/** Build the reserved trailing row-actions column for manual composition. */
export function makeActionsColumn<T extends object>(actions: RowAction<T>[]): ColumnDef<T> {
  return {
    id: ACTIONS_COLUMN_ID,
    label: '',
    type: 'custom',
    align: 'right',
    width: '1%',
    sortable: false,
    searchable: false,
    groupable: false,
    filterable: false,
    render: (_value, row) => (
      <div
        className="flex justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {actions.map((action) => {
          if (action.show?.(row) === false) return null

          return (
            <button
              key={action.key}
              type="button"
              title={action.title}
              aria-label={action.title}
              onClick={() => action.onClick(row)}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md text-dt-muted transition-colors',
                'hover:bg-dt-bg-secondary hover:text-dt-text',
                action.variant === 'danger' &&
                  'hover:bg-dt-negative/10 hover:text-dt-negative',
              )}
            >
              {action.icon}
            </button>
          )
        })}
      </div>
    ),
  }
}
