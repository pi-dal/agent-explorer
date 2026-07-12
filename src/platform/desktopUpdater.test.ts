import { describe, expect, it } from 'vitest'
import { updateProgress } from './desktopUpdater'

describe('desktop updater progress', () => {
  it('returns a bounded download ratio', () => {
    expect(updateProgress(25, 100)).toBe(0.25)
    expect(updateProgress(120, 100)).toBe(1)
    expect(updateProgress(-1, 100)).toBe(0)
  })

  it('returns null when the server omits the content length', () => {
    expect(updateProgress(10)).toBeNull()
    expect(updateProgress(10, 0)).toBeNull()
  })
})
