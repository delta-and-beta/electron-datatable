import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDataTable } from '../../context'

interface DateFilterProps {
  field: string
  className?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

export function DateFilter({ field, className }: DateFilterProps) {
  const { dateFilter, setDateFilter } = useDataTable()
  const [open, setOpen] = useState(false)

  const now = new Date()
  const [viewYear, setViewYear] = useState(() => {
    if (dateFilter && dateFilter.field === field && dateFilter.start) {
      return dateFilter.start.getFullYear()
    }
    return now.getFullYear()
  })

  const isActive = dateFilter !== null && dateFilter.field === field
  const selectedMonth = isActive && dateFilter.start ? dateFilter.start.getMonth() : null
  const selectedYear = isActive && dateFilter.start ? dateFilter.start.getFullYear() : null

  function selectMonth(month: number) {
    const start = new Date(viewYear, month, 1, 0, 0, 0, 0)
    const end = getLastDayOfMonth(viewYear, month)
    setDateFilter({ field, start, end })
    setOpen(false)
  }

  function clearFilter() {
    setDateFilter(null)
    setOpen(false)
  }

  const buttonLabel = isActive && dateFilter.start ? formatMonthYear(dateFilter.start) : 'All dates'

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md border transition-colors',
          'border-gray-600 text-gray-300 hover:bg-gray-700',
          isActive && 'border-blue-500/50 text-blue-400',
          open && 'bg-gray-700',
        )}
      >
        <Calendar className="w-4 h-4" />
        {buttonLabel}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 z-50 mt-1 w-[260px] rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
            {/* Year navigation */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <button
                onClick={() => setViewYear((y) => y - 1)}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors rounded hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-200">{viewYear}</span>
              <button
                onClick={() => setViewYear((y) => y + 1)}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors rounded hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Month grid */}
            <div className="p-3 grid grid-cols-3 gap-1.5">
              {MONTHS.map((label, index) => {
                const isSelected = selectedMonth === index && selectedYear === viewYear

                return (
                  <button
                    key={label}
                    onClick={() => selectMonth(index)}
                    title={`${FULL_MONTHS[index]} ${viewYear}`}
                    className={cn(
                      'h-8 text-xs font-medium rounded-md transition-colors',
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Clear button */}
            {isActive && (
              <div className="px-3 pb-3">
                <button
                  onClick={clearFilter}
                  className="inline-flex items-center gap-1.5 w-full justify-center h-7 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
