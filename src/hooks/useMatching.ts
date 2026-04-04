import { useState, useCallback, useRef, useMemo } from 'react'
import type { RowData, AttachmentAdapter } from '../types'
import type { MatchingAdapter, MatchedFile, UnmatchedFile } from '../matching-types'
import type { UseMatchingReturn } from '../matching-context'
import { filterByMimeType, fileToBase64, DEFAULT_ACCEPTED_TYPES } from '../lib/matching-utils'

type MatchingState = 'idle' | 'reading' | 'ocr' | 'matching' | 'duplicates' | 'reviewing' | 'attaching' | 'done' | 'error'

interface UseMatchingOptions<T extends RowData> {
  matchingAdapter: MatchingAdapter<T> | null
  attachmentAdapter: AttachmentAdapter | null
  data: T[]
  acceptedTypes?: string[]
}

export type { UseMatchingReturn }

export function useMatching<T extends RowData>(options: UseMatchingOptions<T>): UseMatchingReturn {
  const { matchingAdapter, attachmentAdapter, data, acceptedTypes = DEFAULT_ACCEPTED_TYPES } = options
  const enabled = matchingAdapter !== null && attachmentAdapter !== null

  const [state, _setState] = useState<MatchingState>('idle')
  const stateRef = useRef<MatchingState>('idle')
  const setState = useCallback((s: MatchingState) => {
    stateRef.current = s
    _setState(s)
  }, [])
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState<{ phase: string; current: number; total: number } | null>(null)
  const [matches, setMatches] = useState<MatchedFile[]>([])
  const [unmatchedFiles, setUnmatchedFiles] = useState<UnmatchedFile[]>([])
  const [error, setError] = useState<string | undefined>()
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())
  const [bulkDropVisible, setBulkDropVisible] = useState(false)

  const abortedRef = useRef(false)
  const dragCounterRef = useRef(0)
  const fileDataRef = useRef<Map<string, { filename: string; mimeType: string; dataBase64: string }>>(new Map())

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
  }, [])

  const reset = useCallback(() => {
    abortedRef.current = true
    setState('idle')
    setLogs([])
    setProgress(null)
    setMatches([])
    setUnmatchedFiles([])
    setError(undefined)
    setSelectedMatches(new Set())
    setBulkDropVisible(false)
    fileDataRef.current = new Map()
  }, [setState])

  const startMatching = useCallback(async (files: File[]) => {
    if (!matchingAdapter || !attachmentAdapter || stateRef.current !== 'idle') return

    abortedRef.current = false
    const validFiles = filterByMimeType(files, acceptedTypes)

    if (validFiles.length === 0) {
      addLog('No valid files to match')
      return
    }

    try {
      // Phase 1: Reading
      setState('reading')
      addLog(`Received ${validFiles.length} files for bulk matching`)
      setProgress({ phase: 'reading', current: 0, total: validFiles.length })

      const fileDataArray: Array<{ filename: string; mimeType: string; dataBase64: string }> = []
      const fileDataMap = new Map<string, { filename: string; mimeType: string; dataBase64: string }>()

      for (let i = 0; i < validFiles.length; i++) {
        if (abortedRef.current) return
        const file = validFiles[i]
        addLog(`Reading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
        const dataBase64 = await fileToBase64(file)
        const entry = { filename: file.name, mimeType: file.type, dataBase64 }
        fileDataArray.push(entry)
        fileDataMap.set(file.name, entry)
        setProgress({ phase: 'reading', current: i + 1, total: validFiles.length })
      }

      fileDataRef.current = fileDataMap

      // Phase 2: OCR
      if (abortedRef.current) return
      setState('ocr')
      addLog(`Starting OCR on ${fileDataArray.length} files...`)
      setProgress({ phase: 'ocr', current: 0, total: fileDataArray.length })

      const ocrResults = await matchingAdapter.ocr(fileDataArray)

      const successfulOcr = ocrResults.filter((r) => !r.error)
      for (const ocr of ocrResults) {
        if (ocr.error) {
          addLog(`OCR error for ${ocr.filename}: ${ocr.error}`)
        } else {
          const totalChars = ocr.pages.reduce((sum, p) => sum + p.text.length, 0)
          addLog(`OCR complete: ${ocr.filename} - ${ocr.pages.length} page(s), ${totalChars} chars`)
        }
      }

      if (successfulOcr.length === 0) {
        setState('error')
        setError('OCR failed for all files')
        addLog('OCR failed for all files')
        return
      }

      // Phase 3: Matching
      if (abortedRef.current) return
      setState('matching')
      const summaries = data.map((row) => matchingAdapter.summarize(row))
      addLog(`Matching ${successfulOcr.length} OCR results against ${summaries.length} transactions...`)
      setProgress({ phase: 'matching', current: 0, total: successfulOcr.length })

      const matchResult = await matchingAdapter.match(successfulOcr, summaries, (p) => {
        addLog(p.message)
        if (p.phase && p.current !== undefined && p.total !== undefined) {
          setProgress({ phase: p.phase, current: p.current, total: p.total })
        }
      })

      // Phase 4: Duplicate detection
      if (abortedRef.current) return
      setState('duplicates')
      addLog('Checking for duplicate attachments...')
      setProgress({ phase: 'duplicates', current: 0, total: matchResult.matches.length })

      const finalMatches: MatchedFile[] = []
      const finalUnmatched: UnmatchedFile[] = [...matchResult.unmatched_files]

      for (let i = 0; i < matchResult.matches.length; i++) {
        if (abortedRef.current) return
        const m = matchResult.matches[i]
        const existing = await attachmentAdapter.list(m.transaction_id)
        const isDuplicate = existing.some((a) => a.filename === m.filename)

        if (isDuplicate) {
          addLog(`  Skipped (duplicate): ${m.filename} already attached to ${m.transaction_id}`)
          finalUnmatched.push({
            file: m.file,
            filename: m.filename,
            reason: `Already imported - "${m.filename}" is already attached to this transaction`,
          })
        } else {
          addLog(`  Matched: ${m.filename} → ${m.transaction_id} (${m.confidence})`)
          finalMatches.push(m)
        }
        setProgress({ phase: 'duplicates', current: i + 1, total: matchResult.matches.length })
      }

      // Phase 5: Reviewing
      if (abortedRef.current) return
      setMatches(finalMatches)
      setUnmatchedFiles(finalUnmatched)
      setSelectedMatches(new Set(finalMatches.map((m) => m.filename)))
      setProgress(null)
      setState('reviewing')
      addLog(`Ready for review: ${finalMatches.length} matched, ${finalUnmatched.length} unmatched`)
    } catch (err) {
      if (abortedRef.current) return
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState('error')
      setError(message)
      addLog(`Error: ${message}`)
    }
  }, [matchingAdapter, attachmentAdapter, data, acceptedTypes, addLog, setState])

  const toggleMatch = useCallback((filename: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }, [])

  const confirmMatches = useCallback(async () => {
    if (!attachmentAdapter) return

    setState('attaching')
    const toAttach = matches.filter((m) => selectedMatches.has(m.filename))
    addLog(`Attaching ${toAttach.length} files...`)
    setProgress({ phase: 'attaching', current: 0, total: toAttach.length })

    let attached = 0
    let failed = 0

    for (let i = 0; i < toAttach.length; i++) {
      const m = toAttach[i]
      const fileData = fileDataRef.current.get(m.filename)
      if (!fileData) {
        addLog(`  Error: file data not found for ${m.filename}`)
        failed++
        continue
      }

      try {
        await attachmentAdapter.add(m.transaction_id, m.filename, fileData.mimeType, fileData.dataBase64)
        addLog(`  Attached: ${m.filename} → ${m.transaction_id}`)
        attached++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        addLog(`  Failed to attach ${m.filename}: ${msg}`)
        failed++
      }
      setProgress({ phase: 'attaching', current: i + 1, total: toAttach.length })
    }

    addLog(`Done: ${attached} attached, ${failed} failed`)
    setProgress(null)
    setState('done')
  }, [attachmentAdapter, matches, selectedMatches, addLog, setState])

  const getRowDropHandlers = useCallback((rowId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!attachmentAdapter) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDrop: async (e: React.DragEvent) => {
      if (!attachmentAdapter) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)
      const valid = filterByMimeType(files, acceptedTypes)
      if (valid.length !== 1) return

      const file = valid[0]
      const dataBase64 = await fileToBase64(file)
      await attachmentAdapter.add(rowId, file.name, file.type, dataBase64)
    },
  }), [attachmentAdapter, acceptedTypes])

  const dropHandlers = useMemo(() => ({
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (enabled && e.dataTransfer.items.length >= 2) {
        setBulkDropVisible(true)
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setBulkDropVisible(false)
      }
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setBulkDropVisible(false)
      if (!enabled) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length >= 2) {
        startMatching(files)
      }
    },
  }), [enabled, startMatching])

  return {
    state,
    logs,
    progress,
    matches,
    unmatchedFiles,
    error,
    selectedMatches,
    startMatching,
    toggleMatch,
    confirmMatches,
    reset,
    bulkDropVisible,
    dropHandlers,
    getRowDropHandlers,
    enabled,
  }
}
