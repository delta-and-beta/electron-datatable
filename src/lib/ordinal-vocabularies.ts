// Auto-detecting ordinal ordering for group-by headers.
//
// Many categorical fields carry a meaningful order that alphabetical sorting
// destroys — High/Medium/Low, sales-funnel stages, sizes, weekdays, months, …
// This module holds a registry of known ordered vocabularies. Given a set of
// group keys, `resolveOrdinalOrder` returns them in the right order when the
// set is recognized, otherwise null so the caller falls back to alphabetical.
//
// To teach the table a new ordering, add a row to ORDINAL_VOCABULARIES.
// Each array is the canonical (ascending) display order. This list is meant
// to grow over time.

export const ORDINAL_VOCABULARIES: readonly string[][] = [
  // Confidence / severity / priority
  ['High', 'Medium', 'Low'],
  ['Critical', 'High', 'Medium', 'Low'],
  ['Urgent', 'High', 'Normal', 'Low'],
  // Sales funnel
  ['Pipeline', 'Committed', 'Realized', 'N/A'],
  // Opportunity lifecycle stage
  [
    'Open - Lead',
    'Open - Verbal Win',
    'Open - Contracting',
    'Open - Contracted',
    'Closed - Delivered',
    'Closed - Payment Collected',
    'Closed - No-Go',
  ],
  // Project status / engagement
  ['In-Progress', 'Complete'],
  ['Time & Materials', 'Fixed Deliverables'],
  // Invoice status
  ['Draft', 'Issued', 'Invoiced', 'Overdue', 'Settled', 'Voided'],
  // Generic open/closed
  ['Open', 'Closed'],
  // T-shirt sizes
  ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  ['Small', 'Medium', 'Large'],
  // Weekdays
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  // Months
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
]

const normalize = (s: string): string => s.trim().toLowerCase()

/**
 * If every group key (ignoring "(Empty)") belongs to a single known vocabulary,
 * return the keys reordered by that vocabulary's canonical order. Otherwise null.
 *
 * Matching is case- and whitespace-insensitive; the original key strings are
 * returned (only reordered). Needs at least 2 keys — a single group needs no
 * ordering. The first vocabulary that covers all keys wins.
 */
export function resolveOrdinalOrder(keys: string[]): string[] | null {
  const nonEmpty = keys.filter((k) => k !== '(Empty)')
  if (nonEmpty.length < 2) return null

  for (const vocab of ORDINAL_VOCABULARIES) {
    const rank = new Map<string, number>()
    vocab.forEach((v, i) => rank.set(normalize(v), i))

    if (nonEmpty.every((k) => rank.has(normalize(k)))) {
      return [...nonEmpty].sort((a, b) => rank.get(normalize(a))! - rank.get(normalize(b))!)
    }
  }
  return null
}
