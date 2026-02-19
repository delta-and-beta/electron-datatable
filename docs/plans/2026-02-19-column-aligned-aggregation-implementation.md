# Column-Aligned Aggregation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-colSpan group header with per-column cells so aggregated sums align under their respective columns and use each column's own formatter.

**Architecture:** Rewrite `GroupHeader` to render one `<td>` per visible column (first cell = group label, aggregatable cells = formatted sum, others = empty). Update `Content` to pass columns+sums instead of a single sumField.

**Tech Stack:** React, TypeScript, Tailwind CSS, vitest + @testing-library/react

---

### Task 1: Add `formatAggregateValue` helper and test it

**Files:**
- Create: `src/lib/format-aggregate.ts`
- Create: `src/lib/format-aggregate.test.ts`

**Step 1: Write the failing test**

Create `src/lib/format-aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatAggregateValue } from './format-aggregate'
import type { ColumnDef } from '../types'

describe('formatAggregateValue', () => {
  it('uses column.format when provided', () => {
    const col: ColumnDef = {
      id: 'x',
      label: 'X',
      type: 'number',
      format: (v) => `custom:${v}`,
    }
    expect(formatAggregateValue(col, 42)).toBe('custom:42')
  })

  it('formats currency columns with Intl', () => {
    const col: ColumnDef = {
      id: 'amt',
      label: 'Amount',
      type: 'currency',
      currency: 'HKD',
    }
    const result = formatAggregateValue(col, 1234.5)
    expect(result).toContain('HKD')
    expect(result).toContain('1,234.50')
  })

  it('formats currency columns defaulting to USD', () => {
    const col: ColumnDef = {
      id: 'amt',
      label: 'Amount',
      type: 'currency',
    }
    const result = formatAggregateValue(col, 99)
    // Should use USD by default (the $ sign or "USD")
    expect(result).toMatch(/\$|USD/)
  })

  it('formats number columns', () => {
    const col: ColumnDef = {
      id: 'qty',
      label: 'Quantity',
      type: 'number',
    }
    expect(formatAggregateValue(col, 1234)).toBe('1,234')
  })

  it('returns empty string for non-aggregatable types', () => {
    const col: ColumnDef = { id: 't', label: 'T', type: 'text' }
    expect(formatAggregateValue(col, 0)).toBe('')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format-aggregate.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/lib/format-aggregate.ts`:

```ts
import type { ColumnDef } from '../types'
import { formatCurrency, formatNumber } from './format'

/** Format an aggregated value using the column's own formatting pipeline */
export function formatAggregateValue(col: ColumnDef, value: number): string {
  if (col.format) return col.format(value)

  switch (col.type) {
    case 'currency':
      return formatCurrency(value, col.currency)
    case 'number':
      return formatNumber(value)
    default:
      return ''
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format-aggregate.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/lib/format-aggregate.ts src/lib/format-aggregate.test.ts
git commit -m "feat(format): add formatAggregateValue helper with tests"
```

---

### Task 2: Rewrite GroupHeader to per-column cells

**Files:**
- Modify: `src/components/headers/GroupHeader.tsx`

**Step 1: Rewrite `GroupHeaderProps` and rendering**

Replace the entire `GroupHeader.tsx` with per-column rendering. Key changes:
- Remove: `sumAmount`, `sumLabel`, `formatSum`, `colSpan` props
- Add: `columns: ColumnDef[]`, `sums: Record<string, number>` props
- Remove: `defaultFormatSum` helper function
- Sentinel row: keep `colSpan={columns.length}`
- Visible row: render one `<td>` per column
- First cell: group label (chevron + badge + key + count)
- Aggregatable cells: formatted sum with positive/negative coloring
- Other cells: empty

Replace the full file contents. The sticky scroll logic stays the same, but `cell.style.top` applies per `<td>` using a ref callback or by targeting all `<td>` children. Simplest approach: apply `sticky` and `top` on the `<tr>` (already done), and set `background` on each `<td>`.

The `isAggregatable` check: `(col.type === 'currency' || col.type === 'number') && col.sumInGroup !== false`.

Import `formatAggregateValue` from `../../lib/format-aggregate`.

For the sticky push-up effect: the existing code sets `cell.style.top` on a single `<td>`. With multiple `<td>`s, update the scroll handler to set `style.top` on every `<td>` child of the header `<tr>`. Use `header.querySelectorAll('td')` and iterate.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: Errors in `Content.tsx` because it still passes old props — that's expected and fixed in Task 3.

**Step 3: Commit**

```bash
git add src/components/headers/GroupHeader.tsx
git commit -m "feat(GroupHeader): render per-column cells with aligned aggregation"
```

---

### Task 3: Update Content to pass columns + sums

**Files:**
- Modify: `src/components/Content.tsx`

**Step 1: Remove old props, pass new ones**

In `ContentProps`:
- Remove `sumField?: string` and `sumLabel?: string`

In `Content` function:
- Remove destructuring of `sumField` and `sumLabel`

In `renderSubgroup` function:
- Remove `const sumAmount = sumField ? section.sums[sumField] : undefined`
- Change `GroupHeader` call to pass `columns={visibleColumns} sums={section.sums}` instead of `sumAmount`, `sumLabel`, `colSpan`

In the top-level grouped render (the `groupedData.map(...)` block around line 209):
- Same change: remove `sumAmount`/`sumLabel`/`colSpan`, add `columns`/`sums`

Also update the empty state row: change `colSpan={colSpan}` to `colSpan={visibleColumns.length}` (it already uses `colSpan` which equals `visibleColumns.length`, so this is cosmetic — leave as is).

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors

**Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests pass (group-by tests don't touch components)

**Step 4: Commit**

```bash
git add src/components/Content.tsx
git commit -m "feat(Content): wire columns+sums to GroupHeader, remove sumField/sumLabel"
```

---

### Task 4: Add GroupHeader component test

**Files:**
- Create: `src/components/headers/GroupHeader.test.tsx`

**Step 1: Write the component test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupHeader } from './GroupHeader'
import type { ColumnDef } from '../../types'

const columns: ColumnDef[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'amount', label: 'Amount', type: 'currency', currency: 'HKD' },
  { id: 'qty', label: 'Quantity', type: 'number' },
  { id: 'status', label: 'Status', type: 'text' },
]

const sums: Record<string, number> = {
  amount: 1234.5,
  qty: 42,
}

function renderGroupHeader(overrides = {}) {
  return render(
    <table>
      <tbody>
        <GroupHeader
          groupKey="Food"
          fieldLabel="Category"
          level={0}
          count={5}
          isCollapsed={false}
          onToggle={() => {}}
          columns={columns}
          sums={sums}
          {...overrides}
        />
      </tbody>
    </table>,
  )
}

describe('GroupHeader', () => {
  it('renders one td per column', () => {
    renderGroupHeader()
    // The visible row should have 4 tds (one per column)
    // Plus the sentinel row has 1 td with colSpan
    const rows = screen.getAllByRole('row')
    // Find the visible row (not the sentinel)
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    const cells = visibleRow.querySelectorAll('td')
    expect(cells).toHaveLength(4)
  })

  it('shows group key and count in first cell', () => {
    renderGroupHeader()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('formats currency sum in the correct column cell', () => {
    renderGroupHeader()
    // HKD 1,234.50 should appear somewhere
    const text = document.body.textContent!
    expect(text).toMatch(/HKD/)
    expect(text).toMatch(/1,234\.50/)
  })

  it('formats number sum in the correct column cell', () => {
    renderGroupHeader()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('leaves non-aggregatable cells empty', () => {
    renderGroupHeader()
    const rows = screen.getAllByRole('row')
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    const cells = visibleRow.querySelectorAll('td')
    // Last cell (status, type=text) should be empty
    expect(cells[3].textContent).toBe('')
  })

  it('applies negative color class for negative sums', () => {
    renderGroupHeader({ sums: { amount: -500, qty: 10 } })
    const negativeEl = document.querySelector('.text-dt-negative')
    expect(negativeEl).not.toBeNull()
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    renderGroupHeader({ onToggle })
    const rows = screen.getAllByRole('row')
    const visibleRow = rows.find(
      (r) => r.getAttribute('aria-hidden') !== 'true',
    )!
    await userEvent.click(visibleRow)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('respects sumInGroup=false to skip aggregation', () => {
    const cols: ColumnDef[] = [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'amount', label: 'Amount', type: 'currency', currency: 'HKD', sumInGroup: false },
    ]
    renderGroupHeader({ columns: cols, sums: { amount: 999 } })
    const text = document.body.textContent!
    expect(text).not.toMatch(/999/)
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/components/headers/GroupHeader.test.tsx`
Expected: PASS (all 8 tests)

If any fail, fix the GroupHeader implementation to match expected behavior.

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/headers/GroupHeader.test.tsx
git commit -m "test(GroupHeader): add component tests for per-column aggregation"
```

---

### Task 5: Export `formatAggregateValue` from index and clean up

**Files:**
- Modify: `src/index.ts`

**Step 1: Add export**

Check if `formatAggregateValue` should be exported from the package. Add to `src/index.ts`:

```ts
export { formatAggregateValue } from './lib/format-aggregate'
```

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export formatAggregateValue from package"
```
