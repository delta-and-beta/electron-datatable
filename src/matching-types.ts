import type { RowData } from './types'

export interface OcrResult {
  file: string
  filename: string
  pages: Array<{ page: number; text: string }>
  error?: string
}

export interface MatchedFile {
  file: string
  filename: string
  transaction_id: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export interface UnmatchedFile {
  file: string
  filename: string
  reason: string
}

export interface MatchResult {
  matches: MatchedFile[]
  unmatched_files: UnmatchedFile[]
}

export interface TransactionSummary {
  id: string
  date: string
  amount: number
  currency: string
  description: string
}

export interface MatchingProgress {
  message: string
  phase?: 'reading' | 'ocr' | 'matching' | 'duplicates'
  current?: number
  total?: number
}

export interface MatchingAdapter<T extends object = RowData> {
  ocr(files: Array<{ filename: string; mimeType: string; dataBase64: string }>): Promise<OcrResult[]>
  match(
    ocrResults: OcrResult[],
    transactions: TransactionSummary[],
    onProgress: (progress: MatchingProgress) => void,
  ): Promise<MatchResult>
  summarize(row: T): TransactionSummary
}
