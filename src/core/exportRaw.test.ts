import { describe, expect, it } from 'vitest'
import { rawExportFileName } from './exportRaw'

describe('rawExportFileName', () => {
  it('includes line index when available', () => {
    expect(rawExportFileName(42)).toBe('event-line-42.json')
  })

  it('falls back to generic name', () => {
    expect(rawExportFileName()).toBe('event.json')
  })
})