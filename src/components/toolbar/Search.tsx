import { Search as SearchIcon, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDataTable } from '../../context'

interface SearchProps {
  placeholder?: string
  className?: string
}

export function Search({ placeholder = 'Search...', className }: SearchProps) {
  const { searchQuery, setSearchQuery } = useDataTable()

  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-8 pl-9 pr-8 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
