import { useRef, useEffect, useMemo, useCallback, useState, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { emptyState, emptyStateXs, panelHeader } from '../../styles/uiClasses'
import { filterTimelineEvents } from '../../core/filter'
import type { TimelineEvent } from '../../core/types'
import { filterXiaoBaTimeline, isXiaoBaSession, type XiaoBaTimelineScope } from '../../core/xiaoba'
import { useSessionStore } from '../../store/sessionStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useSpringScrollToFn } from '../shared/useSpringScrollToFn'
import { TIMELINE_ITEM_HEIGHT, TimelineItem } from './TimelineItem'
import { TimelineCategoryFilter } from './TimelineCategoryFilter'
import { XiaoBaTimelineFilter } from './XiaoBaTimelineFilter'
import {
  findTimelineEventIndex,
  resolveTimelineNavigationIndex,
} from './timelineNavigation'

const EMPTY_EVENTS: TimelineEvent[] = []

export function TimelinePanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const selectTimelineEvent = useSessionStore((s) => s.selectTimelineEvent)
  const searchQuery = useSettingsStore((s) => s.searchQuery)
  const timelineCategoryFilter = useSettingsStore((s) => s.timelineCategoryFilter)
  const hideSystem = useSettingsStore((s) => s.hideSystem)
  const hideToolCalls = useSettingsStore((s) => s.hideToolCalls)
  const highlightSameRequest = useSettingsStore((s) => s.highlightSameRequest)
  const parentRef = useRef<HTMLDivElement>(null)
  const [xiaobaScope, setXiaoBaScope] = useState<XiaoBaTimelineScope>('all')
  const selectedId = selection?.event?.id
  const isXiaoBa = isXiaoBaSession(session)

  const allEvents = session?.events ?? EMPTY_EVENTS

  const activeRequestId = useMemo(() => {
    if (!highlightSameRequest || !selection) return undefined
    return selection.event?.requestId
  }, [highlightSameRequest, selection])
  const filteredEvents = useMemo(
    () => filterTimelineEvents(allEvents, {
        searchQuery,
        timelineCategoryFilter,
        hideSystem,
        hideToolCalls,
      }),
    [allEvents, searchQuery, timelineCategoryFilter, hideSystem, hideToolCalls],
  )
  const events = useMemo(
    () => isXiaoBa ? filterXiaoBaTimeline(filteredEvents, xiaobaScope) : filteredEvents,
    [filteredEvents, isXiaoBa, xiaobaScope],
  )
  const sessionKey = session
    ? `${session.sourceFilePath ?? session.sourcePath ?? session.fileName}:${session.meta.sessionId ?? ''}`
    : 'empty'

  useEffect(() => {
    setXiaoBaScope('all')
  }, [session?.fileName])

  const scrollToFn = useSpringScrollToFn()
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => `${sessionKey}:${events[index]?.id ?? index}`,
    estimateSize: () => TIMELINE_ITEM_HEIGHT,
    gap: 0,
    overscan: 12,
    scrollToFn
  })

  const scrollToEventIndex = useCallback(
    (index: number) => {
      if (index < 0 || !parentRef.current) return
      virtualizer.scrollToIndex(index, { align: 'auto' })
    },
    [virtualizer],
  )

  const navigateSelection = useCallback(
    (direction: -1 | 1) => {
      if (events.length === 0) return
      const currentIndex = findTimelineEventIndex(events, selectedId)
      const nextIndex = resolveTimelineNavigationIndex(
        events.length,
        currentIndex,
        direction,
      )
      if (nextIndex === null || nextIndex === currentIndex) return
      const event = events[nextIndex]
      if (!event) return
      selectTimelineEvent(event)
      scrollToEventIndex(nextIndex)
    },
    [events, selectedId, selectTimelineEvent, scrollToEventIndex],
  )

  const handleTimelineKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        navigateSelection(1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        navigateSelection(-1)
      }
    },
    [navigateSelection],
  )

  useEffect(() => {
    if (selection?.source === 'timeline') {
      return
    }
    const index = events.findIndex((e) => e.id === selectedId)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
  }, [selection?.source, selectedId, events, virtualizer])

  if (!session) {
    return (
      <div className={`flex h-full items-center justify-center p-4 ${emptyState}`}>
        No session loaded
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className={panelHeader}>
        Timeline · {events.length}
        {events.length !== allEvents.length ? ` / ${allEvents.length}` : ''} events
      </div>
      {isXiaoBa ? (
        <XiaoBaTimelineFilter
          events={filteredEvents}
          value={xiaobaScope}
          onChange={setXiaoBaScope}
        />
      ) : (
        <TimelineCategoryFilter />
      )}
      <div
        ref={parentRef}
        data-testid="timeline-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Timeline events"
        aria-activedescendant={
          selectedId ? `timeline-event-${selectedId}` : undefined
        }
        onKeyDown={handleTimelineKeyDown}
        className="min-h-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"
      >
        {events.length === 0 ? (
          <div className={`flex h-full items-center justify-center p-4 ${emptyStateXs}`}>
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
                  key={`${sessionKey}:${event.id}`}
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
                    selected={selectedId === event.id}
                    requestHighlighted={
                      !!activeRequestId &&
                      event.requestId === activeRequestId &&
                      selectedId !== event.id
                    }
                    onSelect={selectTimelineEvent}
                    onKeyDown={handleTimelineKeyDown}
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
