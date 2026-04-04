import { describe, it, expect } from 'vitest'
import { compareValues, sortRecords } from './sort'

describe('compareValues', () => {
  it('sorts numbers numerically', () => {
    expect(compareValues(2, 10, 'asc')).toBeLessThan(0)
    expect(compareValues(10, 2, 'asc')).toBeGreaterThan(0)
    expect(compareValues(5, 5, 'asc')).toBe(0)
  })

  it('reverses order for desc', () => {
    expect(compareValues(2, 10, 'desc')).toBeGreaterThan(0)
    expect(compareValues(10, 2, 'desc')).toBeLessThan(0)
  })

  it('sorts strings with locale-aware numeric ordering', () => {
    expect(compareValues('banana', 'apple', 'asc')).toBeGreaterThan(0)
    expect(compareValues('10', '2', 'asc')).toBeGreaterThan(0)
  })

  it('sorts null/undefined last regardless of direction', () => {
    expect(compareValues(null, 'a', 'asc')).toBe(1)
    expect(compareValues(null, 'a', 'desc')).toBe(1)
    expect(compareValues('a', null, 'asc')).toBe(-1)
    expect(compareValues(undefined, 'a', 'asc')).toBe(1)
    expect(compareValues(null, null, 'asc')).toBe(0)
  })

  it('falls back to string comparison for mixed types', () => {
    const result = compareValues(100, 'abc', 'asc')
    expect(typeof result).toBe('number')
  })

  it('handles empty string vs null', () => {
    expect(compareValues('', null, 'asc')).toBe(-1)
  })
})

describe('sortRecords', () => {
  const data = [
    { name: 'Charlie', age: 30 },
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 35 },
  ]

  it('sorts by string field ascending', () => {
    const result = sortRecords(data, 'name', 'asc')
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts by string field descending', () => {
    const result = sortRecords(data, 'name', 'desc')
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts by number field', () => {
    const result = sortRecords(data, 'age', 'asc')
    expect(result.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('does not mutate the original array', () => {
    const original = [...data]
    sortRecords(data, 'name', 'asc')
    expect(data).toEqual(original)
  })

  it('handles records with null values', () => {
    const withNulls = [
      { name: 'Bob', age: 30 },
      { name: null, age: null },
      { name: 'Alice', age: 25 },
    ]
    const result = sortRecords(withNulls, 'name', 'asc')
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', null])
  })
})
