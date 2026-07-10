import { describe, expect, it } from 'vitest'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
  it.each([
    [2.5, 2],
    [Number.NaN, 2],
    [-1, 0],
    [25, 20],
  ])('normalizes decimalPlaces %s to %i', (decimalPlaces, normalizedDecimalPlaces) => {
    const value = 123456
    const expectedNumber = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: normalizedDecimalPlaces,
      maximumFractionDigits: normalizedDecimalPlaces,
    }).format(value / 10 ** normalizedDecimalPlaces)

    expect(formatCurrency(value, 'HKD', {
      minorUnits: true,
      decimalPlaces,
      symbol: 'HK$',
    })).toBe(`HK$${expectedNumber}`)
  })

  it('places a negative sign before a custom symbol', () => {
    expect(formatCurrency(-123456, 'HKD', {
      minorUnits: true,
      symbol: 'HK$',
    })).toBe('-HK$1,234.56')
  })
})
