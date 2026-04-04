import { execFileSync, spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import CDP from 'chrome-remote-interface'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, '.screenshots')
const CDP_PORT = 9229
const STARTUP_TIMEOUT = 15000
const POLL_INTERVAL = 500

// ── Helpers ──

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCDP(port, timeout) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const client = await CDP({ port })
      return client
    } catch {
      await sleep(POLL_INTERVAL)
    }
  }
  throw new Error(`CDP not available on port ${port} after ${timeout}ms`)
}

async function screenshot(page, filename) {
  const { data } = await page.Page.captureScreenshot({ format: 'png' })
  const filepath = join(SCREENSHOTS_DIR, filename)
  writeFileSync(filepath, Buffer.from(data, 'base64'))
  console.log(`  📸 ${filename}`)
  return filepath
}

// ── Build ──

console.log('\n🔨 Building data-table library...')
execFileSync('npm', ['run', 'build'], { cwd: join(__dirname, '..'), stdio: 'inherit' })

console.log('📦 Bundling E2E app...')
execFileSync('node', ['esbuild.mjs'], { cwd: __dirname, stdio: 'inherit' })

// ── Launch Electron ──

console.log('🚀 Launching Electron...')
ensureDir(SCREENSHOTS_DIR)

const electronBin = join(__dirname, 'node_modules', '.bin', 'electron')
const electronProcess = spawn(electronBin, ['.', `--remote-debugging-port=${CDP_PORT}`], {
  cwd: __dirname,
  stdio: 'pipe',
  env: { ...process.env, ELECTRON_DISABLE_GPU: '1' },
})

let exitCode = 0
const results = []

function report(name, passed) {
  results.push({ name, passed })
  console.log(`  ${passed ? '✅' : '❌'} ${name}`)
}

try {
  // ── Connect via CDP ──

  console.log('⏳ Waiting for CDP...')
  const client = await waitForCDP(CDP_PORT, STARTUP_TIMEOUT)
  const { Page, Runtime, DOM } = client

  await Page.enable()
  await Runtime.enable()
  await DOM.enable()

  // Clear localStorage from previous runs so defaultGroupBy takes effect
  await Runtime.evaluate({ expression: 'localStorage.clear()' })
  await Runtime.evaluate({ expression: 'location.reload()' })
  await sleep(4000)

  // ── Test 1: Screenshot — Initial Load ──

  console.log('\n📋 Running tests...')
  await screenshot({ Page }, '01-initial-load.png')
  report('Screenshot: initial load captured', true)

  // ── Test 2: Table rendered with rows ──

  const tableResult = await Runtime.evaluate({
    expression: `document.querySelectorAll('table tbody tr').length`,
    returnByValue: true,
  })
  const rowCount = tableResult.result.value
  report(`Table rows rendered: ${rowCount}`, rowCount > 0)

  // ── Test 3: Group headers present ──

  const groupResult = await Runtime.evaluate({
    expression: `document.querySelectorAll('tr[role="button"][aria-expanded]').length`,
    returnByValue: true,
  })
  const groupCount = groupResult.result.value
  report(`Group headers present: ${groupCount}`, groupCount > 0)

  // ── Test 4: MCC category names visible ──

  const categoryResult = await Runtime.evaluate({
    expression: `
      Array.from(document.querySelectorAll('tr[role="button"] td'))
        .map(td => td.textContent)
        .filter(t => t.includes('Grocery') || t.includes('Restaurants') || t.includes('Gas Stations'))
        .length
    `,
    returnByValue: true,
  })
  const categoryCount = categoryResult.result.value
  report(`MCC category groups visible: ${categoryCount}`, categoryCount > 0)

  // ── Test 5: Footer shows record count ──

  const footerResult = await Runtime.evaluate({
    expression: `document.body.innerText.includes('10000') || document.body.innerText.includes('10,000')`,
    returnByValue: true,
  })
  report('Footer shows 10,000 record count', footerResult.result.value === true)

  // ── Test 6: Search input present ──

  const searchResult = await Runtime.evaluate({
    expression: `document.querySelector('input[placeholder="Search..."]') !== null`,
    returnByValue: true,
  })
  report('Search input present', searchResult.result.value === true)

  // ── Test 7: Amount sums visible in group headers ──

  const sumResult = await Runtime.evaluate({
    expression: `
      Array.from(document.querySelectorAll('tr[role="button"] td'))
        .some(td => td.textContent.includes('$'))
    `,
    returnByValue: true,
  })
  report('Amount sums visible in group headers', sumResult.result.value === true)

  // ── Screenshot 2: Grouped state ──

  await screenshot({ Page }, '02-grouped-state.png')
  report('Screenshot: grouped state captured', true)

  // ── Test 8: Title visible ──

  const titleResult = await Runtime.evaluate({
    expression: `document.body.innerText.includes('Bank Transactions')`,
    returnByValue: true,
  })
  report('Title "Bank Transactions" visible', titleResult.result.value === true)

  // ── Test 9: Demo Bulk Match button present ──

  const demoButtonResult = await Runtime.evaluate({
    expression: `document.getElementById('demo-bulk-match') !== null`,
    returnByValue: true,
  })
  report('Demo Bulk Match button present', demoButtonResult.result.value === true)

  // ── Test 10: Trigger bulk matching and wait for dialog ──

  // Set E2E mode for instant mock responses
  await Runtime.evaluate({ expression: 'window.__E2E_MODE__ = true' })

  // Click the demo button
  await Runtime.evaluate({ expression: `document.getElementById('demo-bulk-match').click()` })
  await sleep(2000) // Wait for async matching flow to complete

  const dialogResult = await Runtime.evaluate({
    expression: `document.querySelector('[role="dialog"]') !== null`,
    returnByValue: true,
  })
  report('Matching dialog appeared after bulk match', dialogResult.result.value === true)

  // ── Test 11: Dialog shows matched files ──

  const matchedResult = await Runtime.evaluate({
    expression: `document.body.innerText.includes('Matched files')`,
    returnByValue: true,
  })
  report('Matching dialog shows matched files section', matchedResult.result.value === true)

  // ── Test 12: Confidence badges visible ──

  const badgeResult = await Runtime.evaluate({
    expression: `
      document.body.innerText.includes('High') ||
      document.body.innerText.includes('Medium') ||
      document.body.innerText.includes('Low')
    `,
    returnByValue: true,
  })
  report('Confidence badges visible in matching dialog', badgeResult.result.value === true)

  // ── Screenshot 3: Matching dialog ──

  await screenshot({ Page }, '03-matching-dialog.png')
  report('Screenshot: matching dialog captured', true)

  await client.close()

} catch (err) {
  console.error('\n💥 E2E test error:', err.message)
  exitCode = 1
} finally {
  // ── Cleanup ──

  electronProcess.kill()
  await sleep(1000)

  // ── Summary ──

  console.log('\n' + '─'.repeat(50))
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\nFailed:')
    results.filter((r) => !r.passed).forEach((r) => console.log(`  ❌ ${r.name}`))
    exitCode = 1
  }

  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`)
  console.log('')
  process.exit(exitCode)
}
