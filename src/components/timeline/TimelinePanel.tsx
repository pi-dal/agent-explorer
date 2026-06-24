import { useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TimelineEvent } from '../../core/types'
import { useSessionStore } from '../../store/sessionStore'
import { TIMELINE_ITEM_HEIGHT, TimelineItem } from './TimelineItem'

const EMPTY_EVENTS: TimelineEvent[] = []

export function TimelinePanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const selectTimelineEvent = useSessionStore((s) => s.selectTimelineEvent)
  const parentRef = useRef<HTMLDivElement>(null)

  const events = session?.events ?? EMPTY_EVENTS

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => events[index]?.id ?? String(index),
    estimateSize: () => TIMELINE_ITEM_HEIGHT,
    gap: 0,
    overscan: 12,
  })

  useEffect(() => {
    if (selection?.source !== 'conversation' || !selection.eventId || !parentRef.current) {
      return
    }
    const index = events.findIndex((e) => e.id === selection.eventId)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
  }, [selection?.source, selection?.eventId, events, virtualizer])

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
        Timeline · {events.length} events
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto">
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
      </div>
    </div>
  )
}