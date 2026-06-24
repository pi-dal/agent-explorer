import { useRef, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { filterTimelineEvents } from '../../core/filter'
import type { TimelineEvent } from '../../core/types'
import { useSessionStore } from '../../store/sessionStore'
import { useSettingsStore } from '../../store/settingsStore'
import { TIMELINE_ITEM_HEIGHT, TimelineItem } from './TimelineItem'
import { TimelineCategoryFilter } from './TimelineCategoryFilter'

const EMPTY_EVENTS: TimelineEvent[] = []

export function TimelinePanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const selectTimelineEvent = useSessionStore((s) => s.selectTimelineEvent)
  const searchQuery = useSettingsStore((s) => s.searchQuery)
  const timelineCategoryFilter = useSettingsStore((s) => s.timelineCategoryFilter)
  const hideSystem = useSettingsStore((s) => s.hideSystem)
  const hideToolCalls = useSettingsStore((s) => s.hideToolCalls)
  const syncSelection = useSettingsStore((s) => s.syncSelection)
  const parentRef = useRef<HTMLDivElement>(null)

  const allEvents = session?.events ?? EMPTY_EVENTS
  const events = useMemo(
    () =>
      filterTimelineEvents(allEvents, {
        searchQuery,
        timelineCategoryFilter,
        hideSystem,
        hideToolCalls,
      }),
    [allEvents, searchQuery, timelineCategoryFilter, hideSystem, hideToolCalls],
  )

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => events[index]?.id ?? String(index),
    estimateSize: () => TIMELINE_ITEM_HEIGHT,
    gap: 0,
    overscan: 12,
  })

  useEffect(() => {
    if (
      !syncSelection ||
      selection?.source !== 'conversation' ||
      !selection.eventId ||
      !parentRef.current
    ) {
      return
    }
    const index = events.findIndex((e) => e.id === selection.eventId)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
  }, [syncSelection, selection?.source, selection?.eventId, events, virtualizer])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500">
        No session loaded
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800">
        Timeline · {events.length}
        {events.length !== allEvents.length ? ` / ${allEvents.length}` : ''} events
      </div>
      <TimelineCategoryFilter />
      <div ref={parentRef} className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-xs text-zinc-500">
            No events match the current filters
          </div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = events[virtualRow.index]!
              return (
                <div
                  key={event.id}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                  }}
                >
                  <TimelineItem
                    event={event}
                    selected={selection?.eventId === event.id}
                    onSelect={() => selectTimelineEvent(event.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}