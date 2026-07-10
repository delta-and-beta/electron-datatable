import { type ReactNode } from 'react'
import type { RowData, DataTableProps, AttachmentAdapter } from '../../types'
import type { MatchingAdapter } from '../../matching-types'
import { DataTable } from '../DataTable'
import { MatchingProvider } from '../../matching-context'
import { useMatching } from '../../hooks/useMatching'
import { BulkDropZone } from './BulkDropZone'
import { MatchingReportDialog } from './MatchingReportDialog'
import { cn } from '../../lib/utils'

interface MatchingDataTableProps<T extends RowData> extends DataTableProps<T> {
  matchingAdapter?: MatchingAdapter<T>
  attachmentAdapter?: AttachmentAdapter
  matchingAcceptedTypes?: string[]
  matchingDialogWrapper?: (props: { open: boolean; onClose: () => void; children: ReactNode }) => ReactNode
}

export function MatchingDataTable<T extends RowData>({
  matchingAdapter,
  attachmentAdapter,
  matchingAcceptedTypes,
  matchingDialogWrapper,
  className,
  ...dataTableProps
}: MatchingDataTableProps<T>) {
  const matching = useMatching({
    matchingAdapter: matchingAdapter ?? null,
    attachmentAdapter: attachmentAdapter ?? null,
    data: dataTableProps.data,
    acceptedTypes: matchingAcceptedTypes,
  })

  return (
    <MatchingProvider value={matching}>
      <div className={cn('relative h-full', className)} {...matching.dropHandlers}>
        <DataTable {...dataTableProps} attachmentAdapter={attachmentAdapter} />
        <BulkDropZone />
        <MatchingReportDialog wrapper={matchingDialogWrapper} />
      </div>
    </MatchingProvider>
  )
}
