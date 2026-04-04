const phaseLabels: Record<string, string> = {
  reading: 'Reading files…',
  ocr: 'Running OCR…',
  matching: 'Matching…',
  duplicates: 'Checking duplicates…',
  attaching: 'Attaching files…',
}

export function MatchingProgressBar({ progress }: { progress: { phase: string; current: number; total: number } | null }) {
  if (!progress || progress.total === 0) return null

  const percentage = Math.round((progress.current / progress.total) * 100)
  const label = phaseLabels[progress.phase] ?? progress.phase

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-dt-muted">
        <span>{label}</span>
        <span>{progress.current}/{progress.total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-dt-border">
        <div
          className="h-full rounded-full bg-dt-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
