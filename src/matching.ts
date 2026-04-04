// Types
export type {
  OcrResult,
  MatchedFile,
  UnmatchedFile,
  MatchResult,
  TransactionSummary,
  MatchingProgress,
  MatchingAdapter,
} from './matching-types'

// Hook
export { useMatching } from './hooks/useMatching'
export type { UseMatchingReturn } from './matching-context'

// Context
export { MatchingProvider, useMatchingContext } from './matching-context'

// Components
export { MatchingDataTable } from './components/matching/MatchingDataTable'
export { BulkDropZone } from './components/matching/BulkDropZone'
export { MatchingReportContent } from './components/matching/MatchingReportContent'
export { MatchingReportDialog } from './components/matching/MatchingReportDialog'
export { ConfidenceBadge } from './components/matching/ConfidenceBadge'
export { MatchingProgressBar } from './components/matching/MatchingProgressBar'

// Utilities
export { fileToBase64, filterByMimeType, DEFAULT_ACCEPTED_TYPES } from './lib/matching-utils'
