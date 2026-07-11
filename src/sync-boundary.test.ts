import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'sync' ? [] : productionFiles(path)
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return []
    if (entry.name === 'sync.ts') return []
    return [path]
  })
}

describe('/sync package boundary', () => {
  it('keeps the core entrypoint independent from sync modules', () => {
    const sourceDirectory = resolve(process.cwd(), 'src')
    const syncImport = /from\s+['"][^'"]*\/sync(?:\/|['"])/

    for (const file of productionFiles(sourceDirectory)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(syncImport)
    }
  })
})
