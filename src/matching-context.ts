import { createContext, useContext } from 'react'
import type { MatchedFile, UnmatchedFile } from './matching-types'

/** State shape exposed by useMatching hook */
export interface UseMatchingReturn {
  // State
  state: 'idle' | 'reading' | 'ocr' | 'matching' | 'duplicates' | 'reviewing' | 'attaching' | 'done' | 'error'
  logs: string[]
  progress: { phase: string; current: number; total: number } | null
  matches: MatchedFile[]
  unmatchedFiles: UnmatchedFile[]
  error: string | undefined
  selectedMatches: Set<string>

  // Actions
  startMatching: (files: File[]) => void
  toggleMatch: (filename: string) => void
  confirmMatches: () => Promise<void>
  reset: () => void

  // Drop zone
  bulkDropVisible: boolean
  dropHandlers: {
    onDragEnter: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }

  // Row-level attachment
  getRowDropHandlers: (rowId: string) => {
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }

  // Whether matching is active (both adapters present)
  enabled: boolean
}

const MatchingContext = createContext<UseMatchingReturn | null>(null)

export const MatchingProvider = MatchingContext.Provider

export function useMatchingContext(): UseMatchingReturn | null {
  return useContext(MatchingContext)
}
