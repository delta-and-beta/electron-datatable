import { useState } from 'react'
import { SortToolbarButton } from './SortToolbarButton'
import { SortConfigPanel } from './SortConfigPanel'
import type { ColumnDef } from '../../types'
import type { SortLevel } from '../../lib/sort'

interface SortControlProps {
  levels: SortLevel[]
  columns: ColumnDef[]
  onChange: (levels: SortLevel[]) => void
}

/** Toolbar Sort control — button + popover panel with self-contained open state. */
export function SortControl({ levels, columns, onChange }: SortControlProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <SortToolbarButton activeCount={levels.length} isOpen={open} onClick={() => setOpen(!open)} />
      {open && (
        <SortConfigPanel levels={levels} columns={columns} onChange={onChange} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

SortControl.displayName = 'SortControl'
