import { describe, it, expect } from 'vitest'
import { joinGroupPath, encodeGroupSegment } from './group-path'

describe('encodeGroupSegment', () => {
  it('escapes forward slashes', () => {
    expect(encodeGroupSegment('N/A')).toBe('N%2FA')
  })

  it('escapes percent signs so escaping round-trips', () => {
    expect(encodeGroupSegment('50%2F')).toBe('50%252F')
  })

  it('leaves plain values untouched', () => {
    expect(encodeGroupSegment('Food')).toBe('Food')
  })
})

describe('joinGroupPath', () => {
  it('joins parent and child with a slash', () => {
    expect(joinGroupPath('Food', 'Snacks')).toBe('Food/Snacks')
  })

  it('returns the encoded segment when there is no parent', () => {
    expect(joinGroupPath('', 'Food')).toBe('Food')
  })

  it('does not collide a top-level "N/A" group with nested N → A', () => {
    const topLevel = joinGroupPath('', 'N/A')
    const nested = joinGroupPath(joinGroupPath('', 'N'), 'A')
    expect(topLevel).not.toBe(nested)
  })

  it('does not collide A → B/C with A/B → C', () => {
    const left = joinGroupPath(joinGroupPath('', 'A'), 'B/C')
    const right = joinGroupPath(joinGroupPath('', 'A/B'), 'C')
    expect(left).not.toBe(right)
  })
})
