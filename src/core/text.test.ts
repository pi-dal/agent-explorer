import { describe, expect, it } from 'vitest'
import {
  BLOCK_TEXT_LIMIT,
  DETAIL_TEXT_LIMIT,
  isDetailTruncated,
  truncateBlockText,
  truncatePreview,
} from './text'

describe('text truncation', () => {
  it('truncates previews for list display', () => {
    const text = 'a'.repeat(200)
    expect(truncatePreview(text)).toHaveLength(121)
    expect(truncatePreview(text).endsWith('…')).toBe(true)
  })

  it('caps stored block text', () => {
    const text = 'x'.repeat(BLOCK_TEXT_LIMIT + 100)
    const truncated = truncateBlockText(text)

    expect(truncated.length).toBeLessThan(text.length)
    expect(truncated.endsWith('… [truncated]')).toBe(true)
  })

  it('detects detail truncation threshold', () => {
    expect(isDetailTruncated('a'.repeat(DETAIL_TEXT_LIMIT))).toBe(false)
    expect(isDetailTruncated('a'.repeat(DETAIL_TEXT_LIMIT + 1))).toBe(true)
  })
})