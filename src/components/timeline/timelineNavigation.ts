export function resolveTimelineNavigationIndex(
  eventCount: number,
  currentIndex: number,
  direction: -1 | 1,
): number | null {
  if (eventCount === 0) return null
  if (currentIndex < 0) {
    return direction === 1 ? 0 : eventCount - 1
  }
  const next = currentIndex + direction
  if (next < 0 || next >= eventCount) return currentIndex
  return next
}

export function findTimelineEventIndex(
  events: readonly { id: string }[],
  eventId: string | undefined,
): number {
  if (!eventId) return -1
  return events.findIndex((event) => event.id === eventId)
}