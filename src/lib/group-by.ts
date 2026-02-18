// Pure grouping algorithm — zero dependencies
// Extracted from hsbc-personal, made generic

import type { RowData, GroupLevel, GroupedSection, DatePeriod } from '../types'

/** Minimal column info needed by the grouping algorithm */
type GroupColumnInfo = { id: string; label: string }

/** Extract a display key from a record value */
export function getGroupKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(Empty)'
  return String(value)
}

/** Convert a date string to a period bucket key */
export function getDatePeriodKey(dateStr: string, period: DatePeriod): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '(Invalid Date)'

  const year = date.getFullYear()
  const month = date.getMonth()

  switch (period) {
    case 'day':
      return date.toISOString().slice(0, 10)
    case 'week': {
      const d = new Date(date)
      d.setDate(d.getDate() - d.getDay())
      return `Week of ${d.toISOString().slice(0, 10)}`
    }
    case 'month':
      return `${year}-${String(month + 1).padStart(2, '0')}`
    case 'quarter':
      return `${year} Q${Math.floor(month / 3) + 1}`
    case 'year':
      return String(year)
  }
}

/** Sort group keys with (Empty) pushed to end */
export function sortGroups(keys: string[], direction: 'asc' | 'desc'): string[] {
  return [...keys].sort((a, b) => {
    if (a === '(Empty)') return 1
    if (b === '(Empty)') return -1
    const cmp = a.localeCompare(b, undefined, { numeric: true })
    return direction === 'asc' ? cmp : -cmp
  })
}

/** Recursively group records through multiple group levels */
export function groupRecords(
  records: RowData[],
  levels: GroupLevel[],
  columns: GroupColumnInfo[],
  sumFields: string[] = [],
  currentLevel: number = 0,
): GroupedSection[] {
  if (levels.length === 0 || currentLevel >= levels.length) return []

  const level = levels[currentLevel]
  const column = columns.find((c) => c.id === level.field)
  const fieldLabel = column?.label ?? level.field

  // Bucket records by group key
  const buckets = new Map<string, RowData[]>()

  for (const record of records) {
    const rawValue = record[level.field]
    let key: string

    if (level.datePeriod && typeof rawValue === 'string') {
      key = getDatePeriodKey(rawValue, level.datePeriod)
    } else {
      key = getGroupKey(rawValue)
    }

    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(record)
  }

  // Sort group keys
  const sortedKeys = sortGroups([...buckets.keys()], level.sort)

  // Build sections
  return sortedKeys.map((key) => {
    const groupRecordsArr = buckets.get(key)!

    // Calculate sums
    const sums: Record<string, number> = {}
    for (const field of sumFields) {
      sums[field] = groupRecordsArr.reduce((sum, r) => {
        const val = Number(r[field])
        return sum + (isNaN(val) ? 0 : val)
      }, 0)
    }

    // Recurse into subgroups
    const subgroups =
      currentLevel + 1 < levels.length
        ? groupRecords(groupRecordsArr, levels, columns, sumFields, currentLevel + 1)
        : []

    return {
      key,
      field: level.field,
      fieldLabel,
      level: currentLevel,
      count: groupRecordsArr.length,
      sums,
      records: groupRecordsArr,
      subgroups,
    }
  })
}
