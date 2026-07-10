import * as React from 'react'
import { cn } from '../../lib/utils'

/* ---------------------------------------------------------------------------
 * Table
 * Root <table> element with full-width layout and bottom-aligned captions.
 * --------------------------------------------------------------------------- */

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn(
      // Fixed layout: column widths come from the <colgroup> alone, so header,
      // data, and group rows can never disagree about a column's width.
      'w-full table-fixed caption-bottom text-sm',
      // Column grid: vertical borders on every cell (data, header, group), last column excluded
      '[&_td]:border-r [&_td]:border-dt-border [&_th]:border-r [&_th]:border-dt-border [&_tr>:last-child]:border-r-0',
      className,
    )}
    {...props}
  />
))
Table.displayName = 'Table'

/* ---------------------------------------------------------------------------
 * TableHeader
 * --------------------------------------------------------------------------- */

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

/* ---------------------------------------------------------------------------
 * TableBody
 * --------------------------------------------------------------------------- */

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

/* ---------------------------------------------------------------------------
 * TableFooter
 * --------------------------------------------------------------------------- */

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-[var(--dt-bg-secondary)] font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

/* ---------------------------------------------------------------------------
 * TableRow
 * --------------------------------------------------------------------------- */

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-dt-border transition-colors hover:bg-[var(--dt-bg-secondary)] data-[state=selected]:bg-[var(--dt-bg-secondary)]',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

/* ---------------------------------------------------------------------------
 * TableHead
 * --------------------------------------------------------------------------- */

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle font-medium text-dt-muted [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

/* ---------------------------------------------------------------------------
 * TableCell
 * --------------------------------------------------------------------------- */

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

/* ---------------------------------------------------------------------------
 * TableCaption
 * --------------------------------------------------------------------------- */

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-dt-muted', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
}
