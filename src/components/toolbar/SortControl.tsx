import { useState } from 'react'
import { SortToolbarButton } from './SortToolbarButton'
import { SortConfigPanel } from './SortConfigPanel'
import { Popover } from '../Popover'
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
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={<SortToolbarButton activeCount={levels.length} isOpen={open} />}
      aria-label="Sort configuration"
      contentClassName="w-[460px]"
    >
      <SortConfigPanel levels={levels} columns={columns} onChange={onChange} onClose={() => setOpen(false)} />
    </Popover>
  )
}

SortControl.displayName = 'SortControl'
