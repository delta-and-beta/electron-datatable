import { useState } from 'react'
import { Check, Copy, Eye, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { useDataTable } from '../context'
import type { DataTableRowHeight } from '../types'
import { cn } from '../lib/utils'
import { Popover } from './Popover'
import { MenuItem } from './MenuItem'

const ROW_HEIGHTS: Array<{ value: DataTableRowHeight; label: string }> = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'tall', label: 'Tall' },
]

export function ViewsMenu() {
  const { views } = useDataTable()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  function saveView() {
    if (!name.trim()) return
    views.saveAs(name)
    setName('')
  }

  function finishRename() {
    if (editingId && editingName.trim()) views.rename(editingId, editingName)
    setEditingId(null)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      aria-label="Views"
      contentClassName="w-80"
      trigger={(
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-dt-border px-3 text-xs font-medium text-dt-muted transition-colors hover:bg-dt-bg-secondary hover:text-dt-text"
        >
          <Eye className="h-4 w-4" />
          Views
          {views.isDirty ? <span className="h-1.5 w-1.5 rounded-full bg-dt-primary" aria-hidden="true" /> : null}
        </button>
      )}
    >
      <div className="p-3 text-sm text-dt-text">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-dt-muted">Views</span>
          {views.isDirty ? (
            <button
              type="button"
              aria-label="Update view"
              onClick={() => views.activeViewId && views.update(views.activeViewId)}
              className="text-xs font-medium text-dt-primary hover:underline"
            >
              <span className="mr-1">•</span>
              Unsaved changes
            </button>
          ) : null}
        </div>

        <div className="max-h-52 space-y-1 overflow-y-auto">
          {views.views.length === 0 ? (
            <p className="px-2 py-3 text-xs text-dt-muted">No saved views</p>
          ) : views.views.map((view) => {
            const active = view.id === views.activeViewId
            const isDefault = view.id === views.defaultViewId
            return (
              <div key={view.id} className="flex min-h-9 items-center gap-1 rounded-md hover:bg-dt-bg">
                {editingId === view.id ? (
                  <input
                    autoFocus
                    aria-label={`Rename ${view.name}`}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishRename()
                      if (event.key === 'Escape') setEditingId(null)
                    }}
                    className="mx-1 h-7 min-w-0 flex-1 rounded border border-dt-primary bg-dt-bg px-2 text-xs outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => views.switchTo(view.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-xs"
                  >
                    <span className="w-3 shrink-0">{active ? <Check className="h-3.5 w-3.5 text-dt-primary" /> : null}</span>
                    <span className="truncate">{view.name}</span>
                    {active && views.isDirty ? <span className="text-dt-primary">•</span> : null}
                    {isDefault ? <Star className="ml-auto h-3 w-3 fill-current text-dt-muted" aria-label="Default view" /> : null}
                  </button>
                )}
                <details className="relative mr-1">
                  <summary
                    aria-label={`Actions for ${view.name}`}
                    className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded text-dt-muted hover:bg-dt-bg-secondary hover:text-dt-text"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </summary>
                  <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-dt-border bg-dt-bg-secondary p-1 shadow-lg">
                    <MenuItem icon={<Pencil />} label="Rename" onSelect={() => {
                      setEditingId(view.id)
                      setEditingName(view.name)
                    }} />
                    <MenuItem icon={<Copy />} label="Duplicate" onSelect={() => views.duplicate(view.id)} />
                    <MenuItem icon={<Star />} label="Set default" onSelect={() => views.setDefault(view.id)} />
                    <MenuItem icon={<Trash2 />} label="Delete" variant="danger" onSelect={() => views.remove(view.id)} />
                  </div>
                </details>
              </div>
            )
          })}
        </div>

        <div className="mt-3 border-t border-dt-border pt-3">
          <label className="mb-1 block text-xs text-dt-muted" htmlFor="dt-view-name">Save current as view</label>
          <div className="flex gap-2">
            <input
              id="dt-view-name"
              placeholder="View name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && saveView()}
              className="h-8 min-w-0 flex-1 rounded-md border border-dt-border bg-dt-bg px-2 text-xs outline-none focus:border-dt-primary"
            />
            <button
              type="button"
              aria-label="Save view"
              onClick={saveView}
              disabled={!name.trim()}
              className="h-8 rounded-md bg-dt-primary px-3 text-xs font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-dt-border pt-3">
          <span className="mb-1.5 block text-xs text-dt-muted">Row height</span>
          <div className="grid grid-cols-3 rounded-md border border-dt-border bg-dt-bg p-0.5">
            {ROW_HEIGHTS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={`${option.label} rows`}
                aria-pressed={views.rowHeight === option.value}
                onClick={() => views.setRowHeight(option.value)}
                className={cn(
                  'rounded px-2 py-1 text-xs text-dt-muted transition-colors',
                  views.rowHeight === option.value && 'bg-dt-bg-secondary text-dt-text shadow-sm',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Popover>
  )
}

ViewsMenu.displayName = 'ViewsMenu'
