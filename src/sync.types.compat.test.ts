import type { SyncTarget } from './sync'
import { describe, expect, it } from 'vitest'

const synchronousTarget = {
  upsert(_externalId: string, _row: Record<string, unknown>) {},
  delete(_externalId: string) {},
  async listIds() { return [] },
} satisfies SyncTarget

const asynchronousTarget = {
  async upsert(_externalId: string, _row: Record<string, unknown>) {},
  async delete(_externalId: string) {},
  async listIds() { return [] },
} satisfies SyncTarget

void synchronousTarget
void asynchronousTarget

describe('SyncTarget type compatibility', () => {
  it('accepts synchronous and asynchronous write implementations', () => {
    expect(synchronousTarget).toBeDefined()
    expect(asynchronousTarget).toBeDefined()
  })
})
