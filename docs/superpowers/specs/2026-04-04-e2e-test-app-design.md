# E2E Test App Design

**Date:** 2026-04-04
**Goal:** Create a standalone Electron app that renders the data-table library with 10,000 dummy bank transactions, installs electron-dev-bridge, and runs E2E tests with screenshot verification.

## Data Shape

```ts
interface Transaction {
  id: string
  date: string              // ISO date (YYYY-MM-DD)
  merchant: string
  amount: number            // positive = debit, negative = credit/refund
  mccCode: string           // e.g. "5411"
  mccCategory: string       // e.g. "Grocery Stores"
  status: 'settled' | 'pending' | 'declined'
  cardLast4: string         // e.g. "4829"
}
```

### Column Configuration

| Column | Type | Groupable | Extras |
|--------|------|-----------|--------|
| `date` | `date` | yes | `datePeriods: ['month', 'quarter']` |
| `merchant` | `text` | no | searchable |
| `amount` | `currency` | no | `currency: 'USD'`, `sumInGroup: true` |
| `mccCode` | `text` | no | — |
| `mccCategory` | `text` | yes | primary grouping target |
| `status` | `text` | yes | — |
| `cardLast4` | `text` | no | — |

**Default state:** Grouped by `mccCategory` so the app opens with group headers visible. Default sort by `date` descending.

## Dummy Data Generation

A `generate-data.ts` script produces 10,000 records with:

**~20 MCC categories** with weighted distribution:
- High frequency: Grocery Stores (5411), Restaurants (5812), Gas Stations (5541), Online Shopping (5999)
- Medium frequency: Drug Stores (5912), Fast Food (5814), Clothing Stores (5651), Department Stores (5311)
- Low frequency: Airlines (3000), Hotels (7011), Car Rental (7512), Utilities (4900), Insurance (6300), Telecom (4814), Education (8211), Medical (8011), Entertainment (7922), Subscription Services (5968), Hardware Stores (5251), Sporting Goods (5941)

**Per-category merchant lists** (5-10 merchants each): e.g., Grocery → "Whole Foods", "Trader Joe's", "Safeway", "Kroger", "Aldi"

**Amount ranges** per category: Grocery $5-$200, Airlines $100-$2000, Gas $20-$80, Restaurants $8-$150, etc. ~5% negative amounts (refunds/credits).

**Dates:** Spread across the last 12 months from a fixed anchor date (2026-03-15) for reproducibility.

**Status distribution:** 85% settled, 10% pending, 5% declined.

**Card numbers:** 3-4 random last-4 digits shared across transactions (simulating multiple cards).

Output: `e2e/src/data.json` — static, committed. No runtime generation needed.

## App Structure

```
e2e/
  package.json              # electron, electron-dev-bridge, react, react-dom, esbuild
  main.js                   # Electron main process (single window)
  preload.js                # Minimal contextBridge
  index.html                # Loads bundled React app + data-table styles
  electron-mcp.config.ts    # electron-dev-bridge config with CDP tools
  esbuild.mjs               # Bundle app.tsx → dist/app.js
  test-e2e.mjs              # Automated E2E test script
  .screenshots/             # Screenshot output directory
  src/
    app.tsx                 # React root: DataTable with defineTable, preset="full"
    data.json               # 10,000 generated transaction records
    generate-data.ts        # One-time data generator (run via tsx)
```

### main.js

Single BrowserWindow (1280x800), loads `index.html`, launches with `--remote-debugging-port=9229` for CDP access. Context isolation enabled.

### preload.js

Minimal — no IPC handlers needed. Just the contextBridge boilerplate if electron-dev-bridge requires it.

### index.html

Loads:
- `../dist/styles.css` (data-table base styles from the built library)
- `../dist/themes/dark.css` (dark theme tokens)
- `dist/app.js` (bundled React app)

Root `<div id="root">` for React mount.

### app.tsx

```tsx
import { DataTable, defineTable } from '../../dist/index.js'
import transactions from './data.json'

const table = defineTable<Transaction>({
  rowKey: 'id',
  storageKey: 'bank-transactions',
  columns: {
    date: { label: 'Date', type: 'date', datePeriods: ['month', 'quarter'] },
    merchant: { label: 'Merchant', type: 'text' },
    amount: { label: 'Amount', type: 'currency', currency: 'USD', sumInGroup: true },
    mccCode: { label: 'MCC', type: 'text' },
    mccCategory: { label: 'Category', type: 'text', groupable: true },
    status: { label: 'Status', type: 'text', groupable: true },
    cardLast4: { label: 'Card', type: 'text' },
  },
  defaults: {
    sort: { field: 'date', direction: 'desc' },
    groupBy: [{ field: 'mccCategory', sort: 'asc' }],
  },
})

function App() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DataTable {...table} data={transactions} preset="full" />
    </div>
  )
}
```

### esbuild.mjs

Bundles `src/app.tsx` → `dist/app.js`. Uses esbuild with JSX transform, external React (loaded from CDN in index.html or bundled inline). Targets `chrome120` (Electron's Chromium).

### electron-dev-bridge config

```ts
import { defineConfig } from 'electron-dev-bridge'

export default defineConfig({
  app: {
    name: 'data-table-e2e',
    path: __dirname,
  },
  cdpTools: true,
  screenshots: { dir: '.screenshots', format: 'png' },
})
```

## E2E Test Script

`test-e2e.mjs` — a Node.js script that:

1. **Build:** Runs `npm run build` in the data-table root to ensure `dist/` is fresh
2. **Bundle:** Runs esbuild to bundle `app.tsx` → `dist/app.js`
3. **Launch:** Spawns Electron with `--remote-debugging-port=9229`
4. **Wait:** Polls CDP until the page is ready (document loaded)
5. **Screenshot 1:** Takes `01-initial-load.png` — verifies the table rendered
6. **Assert rows:** Queries DOM for `table` element, checks row count > 0
7. **Assert groups:** Queries DOM for group header elements (elements with `role="button"` and `aria-expanded`), checks count > 0
8. **Screenshot 2:** Takes `02-grouped-state.png` — captures the grouped view
9. **Cleanup:** Kills Electron process
10. **Report:** Prints pass/fail for each assertion, exits with code 0 or 1

Uses `chrome-remote-interface` (already a dependency of electron-dev-bridge) for CDP communication.

## Dependencies

**e2e/package.json:**
- `electron` (devDep)
- `electron-dev-bridge` (devDep)
- `react`, `react-dom` (dep — needed for bundling)
- `esbuild` (devDep — for bundling app.tsx)
- `chrome-remote-interface` (devDep — for E2E CDP assertions)
- `tsx` (devDep — for running generate-data.ts)

## Scripts

```json
{
  "generate": "tsx src/generate-data.ts",
  "bundle": "node esbuild.mjs",
  "start": "electron .",
  "test": "node test-e2e.mjs"
}
```

## What's out of scope

- Hot reload / dev server (not needed for E2E)
- Tailwind preset integration (using pre-built CSS from dist/)
- IPC handlers (no app-specific IPC needed)
- Multiple windows
- CI integration (code-level only per earlier constraint)
