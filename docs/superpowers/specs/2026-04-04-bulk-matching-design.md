# Bulk File Matching with OCR Integration — Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Scope:** Add `/matching` entry point to `@delta-and-beta/electron-datatable`

---

## Overview

Move the bulk file drop → OCR → matching → confirmation → attachment flow from consumer components into the package. Consumers provide a `MatchingAdapter` (OCR + match + summarize backends) and the package handles orchestration, UI, and state management.

This ships as a separate entry point (`@delta-and-beta/electron-datatable/matching`) — consumers who don't use matching pay zero bundle cost.

## Motivation

The matching flow is currently duplicated across `CardTransactionsTab` and `AccountTransactionsTab` in hsbc-business (~200 lines each, ~95% identical). The only difference is `summarize()` — how fields map to matcher input. The adapter pattern (like `AttachmentAdapter`) cleanly abstracts this.

---

## Types

### New types (`src/matching-types.ts`)

Note: `MatchingAdapter` imports `RowData` from `../types` (core). This is the only cross-boundary import from matching → core.

```typescript
export interface OcrResult {
  file: string                              // base64 pass-through
  filename: string
  pages: Array<{ page: number; text: string }>
  error?: string
}

export interface MatchedFile {
  file: string                              // base64 data
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

export interface MatchingAdapter<T extends RowData = RowData> {
  ocr(files: Array<{ filename: string; mimeType: string; dataBase64: string }>): Promise<OcrResult[]>
  match(
    ocrResults: OcrResult[],
    transactions: TransactionSummary[],
    onProgress: (progress: MatchingProgress) => void,
  ): Promise<MatchResult>
  summarize(row: T): TransactionSummary
}
```

### Updated core type (`src/types.ts`)

```typescript
export interface AttachmentAdapter {
  add(rowId: string, filename: string, mimeType: string, dataBase64: string): Promise<Attachment>
  list(rowId: string): Promise<Attachment[]>
  delete(attachmentId: string): Promise<void>
  getCounts(rowIds: string[]): Promise<Record<string, number>>
}
```

Change: `add()` now accepts `(rowId, filename, mimeType, dataBase64)` instead of `(rowId, File)`.

---

## Entry Point Structure

### Package exports (package.json)

```jsonc
{
  ".": "→ core (DataTable, hooks, types, defineTable)",
  "./tailwind": "→ Tailwind preset",
  "./matching": "→ matching types, hook, components, utilities",
  "./styles.css": "→ compiled CSS",
  "./themes/dark.css": "→ dark theme",
  "./themes/light.css": "→ light theme"
}
```

### Source layout

```
src/
  index.ts                   ← core exports (unchanged)
  tailwind.ts                ← Tailwind preset (unchanged)
  matching.ts                ← NEW entry point
  types.ts                   ← core types (AttachmentAdapter updated)
  matching-types.ts          ← NEW: matching-specific types
  hooks/
    useMatching.ts           ← NEW
  components/
    matching/
      BulkDropZone.tsx       ← NEW
      MatchingReportContent.tsx ← NEW
      MatchingReportDialog.tsx  ← NEW
      MatchingProgressBar.tsx   ← NEW
      ConfidenceBadge.tsx       ← NEW
  lib/
    matching-utils.ts        ← NEW: fileToBase64, filterByMimeType
```

### tsup config

Three entry points: `src/index.ts`, `src/tailwind.ts`, `src/matching.ts`.

### Dependency direction

`matching → core` (one-way). Core never imports from matching. Consumers who don't import `/matching` get zero matching code.

---

## `src/matching.ts` — Public API

```typescript
// Types
export type {
  OcrResult, MatchedFile, UnmatchedFile, MatchResult,
  TransactionSummary, MatchingProgress, MatchingAdapter,
} from './matching-types'

// Hook
export { useMatching } from './hooks/useMatching'
export type { UseMatchingReturn } from './hooks/useMatching'

// Context
export { MatchingProvider, useMatchingContext } from './matching-context'

// Components
export { MatchingDataTable } from './components/matching/MatchingDataTable'
export { BulkDropZone } from './components/matching/BulkDropZone'
export { MatchingReportContent } from './components/matching/MatchingReportContent'
export { MatchingReportDialog } from './components/matching/MatchingReportDialog'
export { ConfidenceBadge } from './components/matching/ConfidenceBadge'

// Utilities
export { fileToBase64, filterByMimeType, DEFAULT_ACCEPTED_TYPES } from './lib/matching-utils'
```

---

## `useMatching` Hook

### Options

```typescript
interface UseMatchingOptions<T extends RowData> {
  matchingAdapter: MatchingAdapter<T> | null
  attachmentAdapter: AttachmentAdapter | null
  data: T[]
  acceptedTypes?: string[]   // defaults to DEFAULT_ACCEPTED_TYPES
}
```

### Return value

```typescript
interface UseMatchingReturn {
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
```

### State machine

```
idle → reading → ocr → matching → duplicates → reviewing → attaching → done
                                                              ↓
                                                            error (from any async phase)
```

### `startMatching(files)` flow

1. **reading** — Filter by accepted MIME types. Read each File to base64 via `arrayBuffer()` + `btoa()`. Log file names + sizes. Store in internal `fileDataMap`.
2. **ocr** — Call `matchingAdapter.ocr(fileDataArray)`. Log per-file results. If all fail → error state. Continue with successful files.
3. **matching** — Build summaries via `matchingAdapter.summarize(row)` for all `data`. Call `matchingAdapter.match(ocrResults, summaries, onProgress)`. Append structured progress + log messages.
4. **duplicates** — For each match, call `attachmentAdapter.list(transaction_id)` and check if filename exists. Duplicates moved to `unmatchedFiles` with "Already imported" reason.
5. **reviewing** — All non-duplicate matches pre-selected. User reviews in dialog.

### `confirmMatches()` flow

6. **attaching** — For each filename in `selectedMatches`, call `attachmentAdapter.add(transaction_id, filename, mimeType, dataBase64)`. Log each. Continue on individual failures.
7. **done** — Summary logged. `reset()` clears everything.

### Drop detection

- `onDragEnter` increments a ref counter. Shows drop zone when counter > 0 and `items.length >= 2` and both adapters present.
- `onDragLeave` decrements counter. Hides zone at 0.
- `onDrop` resets counter. Routes: 1 file → `attachmentAdapter.add()` via `getRowDropHandlers` target. 2+ files → `startMatching(files)`.

### Single-file row drops

`getRowDropHandlers(rowId)` returns handlers that read a single dropped file to base64 and call `attachmentAdapter.add(rowId, filename, mimeType, dataBase64)` directly. No OCR, no dialog.

Since `useMatching` lives outside DataTable's context (in `MatchingProvider`), row-level drop handlers are applied by `MatchingDataTable` which wraps content in both providers. For manual composition, consumers access `useMatchingContext()` in their custom row renderer. Alternatively, `MatchingDataTable` can inject row drop handlers by passing a `rowDropHandlers` render prop or by wrapping DataTable's `Content` component.

### Abort on reset

An `abortedRef` flag is set on `reset()`. Each async phase checks the flag before proceeding. No `AbortSignal` on adapter calls (can't force consumer support), but the hook stops processing results.

### No persistence

Matching state is session-only. No localStorage. `reset()` clears everything.

---

## Components

### `MatchingDataTable`

Drop-in wrapper that composes DataTable + matching:

```tsx
<MatchingDataTable
  {...table}
  data={data}
  preset="full"
  attachmentAdapter={attachmentAdapter}
  matchingAdapter={matchingAdapter}
  matchingAcceptedTypes={['application/pdf', 'image/png']}
  matchingDialogWrapper={({ open, onClose, children }) => (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )}
/>
```

Internally: renders `<DataTable>` inside a `<MatchingProvider>` with `<BulkDropZone>` and `<MatchingReportDialog>`, wiring `useMatching` and applying `dropHandlers` to the wrapper div.

### `BulkDropZone`

Full-coverage overlay shown when `bulkDropVisible` is true. Themed with `dt-*` tokens.

```tsx
<div className="absolute inset-0 z-20 flex items-center justify-center
  bg-dt-bg/80 backdrop-blur-sm border-2 border-dashed border-dt-primary rounded-lg">
  <Paperclip icon />
  <p>Drop files to bulk match</p>
</div>
```

Consumes matching state from `MatchingProvider` context.

### `MatchingReportDialog`

Chooses between built-in modal or consumer's `matchingDialogWrapper`:

- **Built-in:** Fixed backdrop + centered panel + escape handling + `role="dialog"` + `aria-modal="true"`
- **Wrapper:** Passes `{ open, onClose, children }` to consumer's component

Renders `<MatchingReportContent />` inside the chosen shell.

### `MatchingReportContent`

The inner dialog content. Four UI states:

1. **Processing** (`reading` | `ocr` | `matching` | `duplicates`): MatchingProgressBar + scrolling log panel + Cancel button
2. **Reviewing** (`reviewing`): Matched files (checkbox + filename + transaction summary + ConfidenceBadge + reason) + Unmatched files (filename + reason) + "Confirm N matches" + Cancel
3. **Attaching** (`attaching`): Progress of attachment calls + log
4. **Error** (`error`): Error message + log + Close button

### `MatchingProgressBar`

Phase label + animated bar. Percentage from `progress.current / progress.total`. Themed with `dt-primary`.

### `ConfidenceBadge`

`high` → dt-positive, `medium` → amber/yellow, `low` → dt-negative. Colored dot + label.

---

## Core Changes (minimal)

1. **`AttachmentAdapter.add()` signature** — `(rowId, filename, mimeType, dataBase64)` instead of `(rowId, File)`
2. **`attachmentCounts` wired up** — DataTable calls `attachmentAdapter.getCounts()` on mount + exposes `refreshAttachmentCounts()` in context
3. **DataTable root div gets `position: relative`** — so BulkDropZone's `absolute inset-0` works when composed around it

No new props on `DataTableProps`. No matching imports in core.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| All files rejected by MIME filter | Log "No valid files", stay idle, no dialog |
| OCR errors for some files | Log per-file errors, continue with rest |
| All OCR fails | Transition to error state |
| Matcher returns 0 matches | Show reviewing with empty matches, all in unmatched |
| All matches are duplicates | Matches empty, all in unmatched with "Already imported" |
| `add()` fails for one file during confirm | Log failure, continue remaining, summary at end |
| Drop while matching in progress | Ignored (state !== idle) |
| Reset during processing | Aborted flag set, phases stop processing |
| Data changes while reviewing | Dialog uses snapshot from when matching started |
| `matchingAdapter` without `attachmentAdapter` | Hook disabled, devWarn() in dev mode |

---

## Testing

### Pure logic (`src/lib/matching-utils.test.ts`)

- `filterByMimeType`: valid/invalid/mixed MIME types
- `fileToBase64`: (limited in jsdom — primarily tested via E2E)

### Hook (`src/hooks/useMatching.test.tsx`)

- Idle/disabled when adapters absent
- Full happy path state transitions
- Single-file drop → direct `add()`
- Bulk drop (2+ files) → startMatching
- MIME filtering
- OCR partial/full failure
- Duplicate detection
- confirmMatches calls add() with correct args
- toggleMatch updates selectedMatches
- reset clears all state
- Abort on reset during processing
- Drag counter / bulkDropVisible

### Components (`src/components/matching/*.test.tsx`)

- MatchingReportDialog: not rendered when idle/null, progress state, reviewing state, checkboxes, confirm/cancel, escape key, wrapper vs built-in
- BulkDropZone: visible/hidden states, themed classes
- ConfidenceBadge: correct colors per level

---

## Consumer Usage

### Zero-config (drop-in wrapper)

```tsx
import { defineTable } from '@delta-and-beta/electron-datatable'
import { MatchingDataTable } from '@delta-and-beta/electron-datatable/matching'

<MatchingDataTable
  {...table}
  data={data}
  preset="full"
  attachmentAdapter={attachmentAdapter}
  matchingAdapter={matchingAdapter}
/>
```

### With shadcn dialog

```tsx
import { MatchingDataTable } from '@delta-and-beta/electron-datatable/matching'
import { Dialog, DialogContent } from '@/components/ui/dialog'

<MatchingDataTable
  {...table}
  data={data}
  preset="full"
  attachmentAdapter={attachmentAdapter}
  matchingAdapter={matchingAdapter}
  matchingDialogWrapper={({ open, onClose, children }) => (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        {children}
      </DialogContent>
    </Dialog>
  )}
/>
```

### Manual composition

```tsx
import { DataTable } from '@delta-and-beta/electron-datatable'
import { useMatching, MatchingProvider, BulkDropZone, MatchingReportDialog } from '@delta-and-beta/electron-datatable/matching'

function MyTable({ data }) {
  const matching = useMatching({ matchingAdapter, attachmentAdapter, data })

  return (
    <MatchingProvider value={matching}>
      <div className="relative" {...matching.dropHandlers}>
        <DataTable {...table} data={data} preset="full" />
        <BulkDropZone />
        <MatchingReportDialog />
      </div>
    </MatchingProvider>
  )
}
```

---

## Allowed File Types

Default: `['application/pdf', 'image/png', 'image/jpeg', 'image/gif']`

Overridable via `matchingAcceptedTypes` prop on `MatchingDataTable`, or `acceptedTypes` option on `useMatching`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/matching-types.ts` | Matching type definitions |
| `src/matching-context.ts` | MatchingProvider + useMatchingContext |
| `src/matching.ts` | Entry point (re-exports) |
| `src/lib/matching-utils.ts` | fileToBase64, filterByMimeType, DEFAULT_ACCEPTED_TYPES |
| `src/hooks/useMatching.ts` | Matching state machine hook |
| `src/components/matching/MatchingDataTable.tsx` | Drop-in wrapper |
| `src/components/matching/BulkDropZone.tsx` | Drop overlay |
| `src/components/matching/MatchingReportContent.tsx` | Dialog inner content |
| `src/components/matching/MatchingReportDialog.tsx` | Dialog shell (built-in or wrapped) |
| `src/components/matching/MatchingProgressBar.tsx` | Progress bar |
| `src/components/matching/ConfidenceBadge.tsx` | Confidence indicator |

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Update `AttachmentAdapter.add()` signature |
| `src/context.ts` | Add `refreshAttachmentCounts` to context interface |
| `src/components/DataTable.tsx` | Wire `attachmentCounts` via `getCounts()` on mount, add `position: relative` to root div, expose `refreshAttachmentCounts` |
| `tsup.config.ts` | Add `src/matching.ts` entry point |
| `package.json` | Add `"./matching"` export path |
