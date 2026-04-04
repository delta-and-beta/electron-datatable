import { describe, it, expect } from 'vitest'
import { filterByMimeType, DEFAULT_ACCEPTED_TYPES } from './matching-utils'

describe('DEFAULT_ACCEPTED_TYPES', () => {
  it('includes PDF, PNG, JPEG, GIF', () => {
    expect(DEFAULT_ACCEPTED_TYPES).toContain('application/pdf')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/png')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/jpeg')
    expect(DEFAULT_ACCEPTED_TYPES).toContain('image/gif')
  })
})

describe('filterByMimeType', () => {
  const makeFile = (name: string, type: string): File =>
    new File(['content'], name, { type })

  it('keeps files with accepted MIME types', () => {
    const files = [makeFile('doc.pdf', 'application/pdf'), makeFile('photo.png', 'image/png')]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(2)
  })

  it('rejects files with unaccepted MIME types', () => {
    const files = [makeFile('app.exe', 'application/octet-stream'), makeFile('data.csv', 'text/csv')]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(0)
  })

  it('filters a mix of valid and invalid files', () => {
    const files = [makeFile('doc.pdf', 'application/pdf'), makeFile('app.exe', 'application/octet-stream'), makeFile('photo.jpg', 'image/jpeg')]
    const result = filterByMimeType(files, DEFAULT_ACCEPTED_TYPES)
    expect(result).toHaveLength(2)
    expect(result.map(f => f.name)).toEqual(['doc.pdf', 'photo.jpg'])
  })

  it('returns empty array for empty input', () => {
    expect(filterByMimeType([], DEFAULT_ACCEPTED_TYPES)).toEqual([])
  })

  it('uses custom accepted types when provided', () => {
    const files = [makeFile('doc.pdf', 'application/pdf'), makeFile('photo.png', 'image/png')]
    const result = filterByMimeType(files, ['image/png'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('photo.png')
  })
})
