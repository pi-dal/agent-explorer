import { describe, expect, it } from 'vitest'
import {
  findTimelineEventIndex,
  resolveTimelineNavigationIndex,
} from './timelineNavigation'

describe('resolveTimelineNavigationIndex', () => {
  it('returns null for empty lists', () => {
    expect(resolveTimelineNavigationIndex(0, -1, 1)).toBeNull()
  })

  it('selects first or last when nothing is selected', () => {
    expect(resolveTimelineNavigationIndex(5, -1, 1)).toBe(0)
    expect(resolveTimelineNavigationIndex(5, -1, -1)).toBe(4)
  })

  it('moves within bounds', () => {
    expect(resolveTimelineNavigationIndex(5, 2, 1)).toBe(3)
    expect(resolveTimelineNavigationIndex(5, 2, -1)).toBe(1)
  })

  it('clamps at the edges', () => {
    expect(resolveTimelineNavigationIndex(5, 0, -1)).toBe(0)
    expect(resolveTimelineNavigationIndex(5, 4, 1)).toBe(4)
  })
})

describe('findTimelineEventIndex', () => {
  const events = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('returns -1 when id is missing or not found', () => {
    expect(findTimelineEventIndex(events, undefined)).toBe(-1)
    expect(findTimelineEventIndex(events, 'missing')).toBe(-1)
  })

  it('finds the matching event index', () => {
    expect(findTimelineEventIndex(events, 'b')).toBe(1)
  })
})