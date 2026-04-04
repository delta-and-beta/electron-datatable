import { useRef, useEffect } from 'react'
import { useMatchingContext } from '../../matching-context'
import { MatchingProgressBar } from './MatchingProgressBar'
import { ConfidenceBadge } from './ConfidenceBadge'

export function MatchingReportContent() {
  const matching = useMatchingContext()
  if (!matching) return null

  const { state, logs, progress, matches, unmatchedFiles, error, selectedMatches, toggleMatch, confirmMatches, reset } = matching
  const isProcessing = state === 'reading' || state === 'ocr' || state === 'matching' || state === 'duplicates'
  const selectedCount = matches.filter((m) => selectedMatches.has(m.filename)).length

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dt-border px-6 py-4">
        <h2 className="text-lg font-semibold text-dt-text">
          {isProcessing ? 'Matching files…' : state === 'attaching' ? 'Attaching files…' : state === 'error' ? 'Matching failed' : 'Matching results'}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Progress bar */}
        {(isProcessing || state === 'attaching') && <MatchingProgressBar progress={progress} />}

        {/* Error message */}
        {state === 'error' && error && (
          <div className="rounded-lg border border-dt-negative/30 bg-dt-negative/10 p-3 text-sm text-dt-negative">
            {error}
          </div>
        )}

        {/* Log panel */}
        {(isProcessing || state === 'attaching' || state === 'error') && <LogPanel logs={logs} />}

        {/* Matched files */}
        {state === 'reviewing' && matches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-dt-text mb-2">Matched files ({matches.length})</h3>
            <div className="space-y-2">
              {matches.map((m) => (
                <label key={m.filename} className="flex items-start gap-3 rounded-lg border border-dt-border p-3 cursor-pointer hover:bg-dt-bg-secondary">
                  <input
                    type="checkbox"
                    checked={selectedMatches.has(m.filename)}
                    onChange={() => toggleMatch(m.filename)}
                    className="mt-0.5 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dt-text truncate">{m.filename}</span>
                      <ConfidenceBadge confidence={m.confidence} />
                    </div>
                    <p className="text-xs text-dt-muted mt-0.5">→ {m.transaction_id}</p>
                    <p className="text-xs text-dt-muted">{m.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched files */}
        {state === 'reviewing' && unmatchedFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-dt-text mb-2">Unmatched files ({unmatchedFiles.length})</h3>
            <div className="space-y-2">
              {unmatchedFiles.map((u) => (
                <div key={u.filename} className="rounded-lg border border-dt-border p-3">
                  <span className="text-sm font-medium text-dt-text">{u.filename}</span>
                  <p className="text-xs text-dt-muted mt-0.5">{u.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviewing with 0 matches */}
        {state === 'reviewing' && matches.length === 0 && unmatchedFiles.length === 0 && (
          <p className="text-sm text-dt-muted">No matches or files to show.</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-dt-border px-6 py-4">
        {(isProcessing || state === 'error' || state === 'reviewing') && (
          <button
            onClick={reset}
            className="rounded-lg border border-dt-border px-4 py-2 text-sm text-dt-text hover:bg-dt-bg-secondary"
          >
            {state === 'error' ? 'Close' : 'Cancel'}
          </button>
        )}
        {state === 'reviewing' && selectedCount > 0 && (
          <button
            onClick={confirmMatches}
            className="rounded-lg bg-dt-primary px-4 py-2 text-sm font-medium text-white hover:bg-dt-primary-hover"
          >
            Confirm {selectedCount} {selectedCount === 1 ? 'match' : 'matches'}
          </button>
        )}
      </div>
    </div>
  )
}

function LogPanel({ logs }: { logs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div ref={scrollRef} className="max-h-48 overflow-y-auto rounded-lg border border-dt-border bg-dt-bg-secondary p-3 font-mono text-xs text-dt-muted">
      {logs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  )
}
